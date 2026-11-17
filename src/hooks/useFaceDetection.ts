import { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceDetector, Detection } from "@mediapipe/tasks-vision";

export type FaceAlignmentStatus = "aligned" | "not_centered" | "missing";

export interface FaceDetectionState {
  isFaceDetected: boolean;
  isFaceAligned: boolean;
  alignmentStatus: FaceAlignmentStatus;
  faceCount: number;
  isModelLoading: boolean;
  modelError: string | null;
  confidence: number;
}

interface UseFaceDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  guideRef?: React.RefObject<HTMLElement>;
  enabled?: boolean;
  debounceMissingMs?: number; // Time before marking face as lost
  detectionIntervalMs?: number; // Throttle interval
}

const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

export const useFaceDetection = ({
  videoRef,
  guideRef,
  enabled = true,
  debounceMissingMs = 600,
  detectionIntervalMs = 100,
}: UseFaceDetectionOptions): FaceDetectionState => {
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(true);
  const [isFaceAligned, setIsFaceAligned] = useState<boolean>(true);
  const [alignmentStatus, setAlignmentStatus] = useState<FaceAlignmentStatus>("aligned");
  const [faceCount, setFaceCount] = useState<number>(1);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(1);

  const detectorRef = useRef<FaceDetector | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastDetectionTimeRef = useRef<number>(0);
  const missingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCurrentlyDetectedRef = useRef<boolean>(true);
  const isPreviouslyAlignedRef = useRef<boolean>(false);

  // Initialize MediaPipe FaceDetector with GPU -> CPU fallback
  useEffect(() => {
    let isMounted = true;

    const initDetector = async () => {
      try {
        setIsModelLoading(true);
        setModelError(null);

        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        if (!isMounted) return;

        let detector: FaceDetector;
        try {
          // Attempt GPU delegate first
          detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_PATH,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            minDetectionConfidence: 0.35,
          });
        } catch (gpuErr) {
          console.warn("GPU delegate unsupported, falling back to CPU:", gpuErr);
          detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_PATH,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            minDetectionConfidence: 0.35,
          });
        }

        if (!isMounted) {
          detector.close();
          return;
        }

        detectorRef.current = detector;
        setIsModelLoading(false);
        console.log("👁️ [FaceDetector] Initialized successfully in all modes");
      } catch (err: any) {
        console.error("👁️ [FaceDetector] Initialization failed:", err);
        if (isMounted) {
          setModelError(err?.message || "Failed to initialize face detector");
          setIsModelLoading(false);
          // Default to true so user is never blocked if browser restricts WASM/WebGL
          setIsFaceDetected(true);
          setIsFaceAligned(true);
          setAlignmentStatus("aligned");
        }
      }
    };

    initDetector();

    return () => {
      isMounted = false;
      if (detectorRef.current) {
        try {
          detectorRef.current.close();
        } catch (e) {
          // ignore
        }
        detectorRef.current = null;
      }
    };
  }, []);

  // Run detection loop
  useEffect(() => {
    if (!enabled || !detectorRef.current) {
      return;
    }

    let isRunning = true;

    const detectLoop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const detector = detectorRef.current;

      if (
        video &&
        detector &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        !video.paused &&
        !video.ended
      ) {
        const now = performance.now();
        if (now - lastDetectionTimeRef.current >= detectionIntervalMs) {
          lastDetectionTimeRef.current = now;

          try {
            const results = detector.detectForVideo(video, now);
            const rawDetections: Detection[] = results?.detections || [];

            // 1. Filter out background wall photos/posters (must be real foreground candidate face)
            const validDetections = rawDetections.filter((d) => {
              if (!d.boundingBox) return false;
              const score = d.categories?.[0]?.score ?? 0;
              if (score < 0.40) return false;

              const widthRatio = d.boundingBox.width / video.videoWidth;
              const heightRatio = d.boundingBox.height / video.videoHeight;

              // Face must occupy at least 8% width & 9% height (not a tiny background face in a picture)
              return widthRatio >= 0.08 && heightRatio >= 0.09;
            });

            // 2. Check if face is placed inside the visible face sketch / oval guide on screen
            let isAnyFaceAligned = false;

            if (guideRef?.current && video) {
              const videoRect = video.getBoundingClientRect();
              const guideRect = guideRef.current.getBoundingClientRect();

              // Calculate exact CSS object-cover transformation from video stream to screen pixels
              const scale = Math.max(
                videoRect.width / video.videoWidth,
                videoRect.height / video.videoHeight
              );
              const renderedWidth = video.videoWidth * scale;
              const renderedHeight = video.videoHeight * scale;
              const renderedLeft = videoRect.left + (videoRect.width - renderedWidth) / 2;
              const renderedTop = videoRect.top + (videoRect.height - renderedHeight) / 2;

              const guideCenterX = guideRect.left + guideRect.width / 2;
              const guideCenterY = guideRect.top + guideRect.height / 2;
              const rx = guideRect.width / 2;
              const ry = guideRect.height / 2;

              for (const d of validDetections) {
                if (!d.boundingBox) continue;

                // Center of the face in video stream coordinates
                const faceVideoCenterX = d.boundingBox.originX + d.boundingBox.width / 2;
                const faceVideoCenterY = d.boundingBox.originY + d.boundingBox.height / 2;

                // Mapped to actual on-screen viewport coordinates
                const faceScreenX = renderedLeft + faceVideoCenterX * scale;
                const faceScreenY = renderedTop + faceVideoCenterY * scale;

                // Compute normalized distance to oval center
                const normX = (faceScreenX - guideCenterX) / rx;
                const normY = (faceScreenY - guideCenterY) / ry;
                const distSquared = normX * normX + normY * normY;

                // Dual-boundary hysteresis: tighter threshold to enter (0.95), forgiving to stay (1.15)
                const threshold = isPreviouslyAlignedRef.current ? 1.15 : 0.95;

                if (distSquared <= threshold) {
                  isAnyFaceAligned = true;
                  break;
                }
              }
            } else {
              // Fallback if guideRef is not passed
              for (const d of validDetections) {
                if (!d.boundingBox) continue;
                const centerX = (d.boundingBox.originX + d.boundingBox.width / 2) / video.videoWidth;
                const centerY = (d.boundingBox.originY + d.boundingBox.height / 2) / video.videoHeight;
                if (centerX >= 0.35 && centerX <= 0.65 && centerY >= 0.15 && centerY <= 0.65) {
                  isAnyFaceAligned = true;
                  break;
                }
              }
            }

            const count = validDetections.length;

            if (count > 0) {
              const maxScore = Math.max(
                ...validDetections.map((d) => d.categories[0]?.score || 0)
              );
              setFaceCount(count);
              setConfidence(maxScore);

              if (missingTimerRef.current) {
                clearTimeout(missingTimerRef.current);
                missingTimerRef.current = null;
              }

              isCurrentlyDetectedRef.current = true;
              setIsFaceDetected(true);

              if (isAnyFaceAligned) {
                isPreviouslyAlignedRef.current = true;
                setIsFaceAligned(true);
                setAlignmentStatus("aligned");
              } else {
                isPreviouslyAlignedRef.current = false;
                setIsFaceAligned(false);
                setAlignmentStatus("not_centered");
              }
            } else {
              // No foreground user face in frame
              isPreviouslyAlignedRef.current = false;
              if (isCurrentlyDetectedRef.current && !missingTimerRef.current) {
                missingTimerRef.current = setTimeout(() => {
                  isCurrentlyDetectedRef.current = false;
                  setIsFaceDetected(false);
                  setIsFaceAligned(false);
                  setAlignmentStatus("missing");
                  setFaceCount(0);
                  missingTimerRef.current = null;
                }, debounceMissingMs);
              }
            }

          } catch (err) {
            // Drop frame gracefully without crash
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(detectLoop);
    };

    animFrameRef.current = requestAnimationFrame(detectLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (missingTimerRef.current) {
        clearTimeout(missingTimerRef.current);
        missingTimerRef.current = null;
      }
    };
  }, [enabled, debounceMissingMs, detectionIntervalMs, videoRef, guideRef, isModelLoading]);

  return {
    isFaceDetected,
    isFaceAligned,
    alignmentStatus,
    faceCount,
    isModelLoading,
    modelError,
    confidence,
  };
};
