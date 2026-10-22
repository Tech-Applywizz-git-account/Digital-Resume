import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { showToast } from "../components/ui/toast";
import { X, Loader2, RotateCcw, Check, Video } from "lucide-react";
import { isSafeUUID } from "../utils/uuidHelpers";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { FaceGuideOverlay } from "../components/recording/FaceGuideOverlay";
import { injectWebmDuration } from "../utils/fixWebmDuration";


/**
 * Enhanced Camera/Recorder Page
 * Ensures hardware is released properly upon completion or navigation.
 * Features Face-Gated Recording: recording automatically pauses when no face is visible.
 */
const Record: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = new URLSearchParams(location.search).get('mode');
  const { user } = useAuth();

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedSecondsRef = useRef<number>(0);
  const scrollOffsetYRef = useRef<number>(0);

  // State
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recorderReady, setRecorderReady] = useState(false);
  const [state, setState] = useState<"idle" | "recording" | "preview">("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [timer, setTimer] = useState("0:00");
  const [isUploading, setIsUploading] = useState(false);
  const [teleprompterText, setTeleprompterText] = useState("");
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(1.0);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);
  const [startAttemptWarning, setStartAttemptWarning] = useState<string | null>(null);
  const [shakeButton, setShakeButton] = useState(false);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔹 Real-time client-side face detection & outline framing
  const { isFaceDetected, isFaceAligned, alignmentStatus, isModelLoading } = useFaceDetection({
    videoRef,
    guideRef,
    enabled: recorderReady && state !== "preview",
  });





  // ------------------------------------------
  // Core Logic Helpers
  // ------------------------------------------

  const stopCamera = () => {
    // 1. Explicitly stop the live stream from the ref
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        track.stop();
        track.enabled = false;
      });
      console.log(`📷 Stopped ${tracks.length} tracks from streamRef`);
      streamRef.current = null;
    }
    
    // 2. Double check the video element itself to release hardware
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const activeStream = videoRef.current.srcObject as MediaStream;
        const tracks = activeStream.getTracks();
        tracks.forEach(track => {
          track.stop();
          track.enabled = false;
        });
        console.log(`📷 Stopped ${tracks.length} tracks from videoRef.srcObject`);
      }
      videoRef.current.srcObject = null;
    }
    console.log("📷 Camera hardware completely released");
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const startTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      elapsedSecondsRef.current += 1;
      setTimer(formatTime(elapsedSecondsRef.current));
    }, 1000);
  };

  const pauseTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const resumeTimer = () => {
    startTimer();
  };

  const resetTimer = () => {
    pauseTimer();
    elapsedSecondsRef.current = 0;
    setTimer("0:00");
  };

  const startTeleprompterScroll = () => {
    if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    const speed = parseFloat(localStorage.getItem("teleprompterSpeed") || "1");
    scrollIntervalRef.current = setInterval(() => {
      scrollOffsetYRef.current -= 0.08 * speed;
      if (teleprompterRef.current) {
        teleprompterRef.current.style.transform = `translate(-50%, ${scrollOffsetYRef.current}%)`;
      }
      if (scrollOffsetYRef.current < -200) {
        if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      }
    }, 40);
  };

  const pauseTeleprompterScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const resumeTeleprompterScroll = () => {
    startTeleprompterScroll();
  };

  const resetTeleprompterPosition = () => {
    pauseTeleprompterScroll();
    scrollOffsetYRef.current = 0;
    if (teleprompterRef.current) {
      teleprompterRef.current.style.transform = "translate(-50%, 0%)";
    }
  };


  // 🔹 Load teleprompter text
  useEffect(() => {
    let text = localStorage.getItem("teleprompterText") || "";
    
    // Check for placeholder
    if (!text || text === "Generated from resume analysis") {
      text = "Please complete Step 2 to generate your introduction script before recording.";
    }

    const speed = parseFloat(localStorage.getItem("teleprompterSpeed") || "1.0");
    
    setTeleprompterText(text);
    setTeleprompterSpeed(speed);
    setTimeout(resetTeleprompterPosition, 100);
  }, []);

  // 🔹 Check user credits on mount (CRM Aware)
  useEffect(() => {
    const checkCredits = async () => {
      let currentUser = user;
      if (!currentUser) {
        const storedUser = localStorage.getItem("userData");
        if (storedUser) currentUser = JSON.parse(storedUser);
      }
      if (!currentUser) return;

      setCheckingCredits(true);
      try {
        const isCRMUser = localStorage.getItem("is_crm_user") === "true";
        const crmEmail = localStorage.getItem("crm_user_email");

        if (isCRMUser && crmEmail) {
          const { data, error } = await supabase
            .from('digital_resume_by_crm')
            .select('credits_remaining')
            .eq('email', crmEmail)
            .single();

          if (!error) setCreditsRemaining(data?.credits_remaining ?? 0);
        } else {
          const { data, error } = await supabase
            .from('profiles')
            .select('credits_remaining')
            .eq('id', currentUser.id)
            .single();

          if (!error) setCreditsRemaining(data?.credits_remaining ?? 0);
        }
      } catch (err) {
        console.error('Error checking credits:', err);
      } finally {
        setCheckingCredits(false);
      }
    };

    checkCredits();
  }, [user]);

  // 🔹 Camera + Recorder Setup
  const handleRecordingStopRef = useRef<() => void>(() => {});

  const setupCamera = useCallback(async () => {
    try {
      setRecorderReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          aspectRatio: 16 / 9,
          frameRate: { ideal: 30, max: 60 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        streamRef.current = stream;
        stream.getVideoTracks().forEach((track) => (track.enabled = true));
      }

      await new Promise((r) => setTimeout(r, 600));

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 5000000,
          audioBitsPerSecond: 128_000,
        });
      } catch {
        recorder = new MediaRecorder(stream, { mimeType });
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        handleRecordingStopRef.current();
      };
      recorder.onerror = (err) => console.error("⚠️ Recorder error:", err);

      setMediaRecorder(recorder);
      setRecorderReady(true);
    } catch (err) {
      console.error("🚫 Camera/Mic access failed:", err);
      showToast("Please allow camera and microphone access, then reload the page.", "error");
      setRecorderReady(false);
    }
  }, []);

  useEffect(() => {
    setupCamera();

    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      stopCamera();
    };
  }, [setupCamera]);

  // Clean up preview object URL on unmount
  const previewUrlRef = useRef<string | null>(null);
  previewUrlRef.current = previewUrl;
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // 🔹 Auto-pause & Safe Cancellable Countdown Resume
  useEffect(() => {
    if (state !== "recording" || !mediaRecorder) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setResumeCountdown(null);
      return;
    }

    // 1. IF FACE IS NOT ALIGNED (OR LOST)
    if (!isFaceAligned) {
      // Abort any pending countdown immediately
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setResumeCountdown(null);

      // Pause recording if active
      if (!isAutoPaused) {
        if (mediaRecorder.state === "recording") {
          try {
            mediaRecorder.pause();
            console.log("⏸️ Recording auto-paused: Face left outline");
          } catch (e) {
            console.error("Error pausing recorder:", e);
          }
        }
        pauseTimer();
        pauseTeleprompterScroll();
        setIsAutoPaused(true);
      }
      return;
    }

    // 2. IF FACE IS PROPERLY ALIGNED AND RECORDING IS CURRENTLY PAUSED
    if (isFaceAligned && isAutoPaused) {
      // If countdown is already ticking, let it continue
      if (countdownTimerRef.current) {
        return;
      }

      // Start 2-second countdown: 2 -> 1 -> Resume!
      let count = 2;
      setResumeCountdown(count);

      countdownTimerRef.current = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setResumeCountdown(count);
        } else {
          // Timer finished! Complete resume
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setResumeCountdown(null);

          if (mediaRecorder.state === "paused") {
            try {
              mediaRecorder.resume();
              console.log("▶️ Recording auto-resumed: Face confirmed aligned");
            } catch (e) {
              console.error("Error resuming recorder:", e);
            }
          }
          resumeTimer();
          resumeTeleprompterScroll();
          setIsAutoPaused(false);
          showToast("Face aligned. Recording resumed.", "success");
        }
      }, 1000);
    }
  }, [isFaceAligned, state, mediaRecorder, isAutoPaused]);

  // ------------------------------------------
  // Recording Handlers
  // ------------------------------------------

  const handleRecordClick = async () => {
    if (!mediaRecorder) return;

    if (state === "idle") {
      if (!isFaceAligned) {
        setShakeButton(true);
        setTimeout(() => setShakeButton(false), 500);

        const msg = alignmentStatus === "not_centered"
          ? "Please center your face inside the oval to start recording"
          : "Please look into the camera to start recording";

        setStartAttemptWarning(msg);
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = setTimeout(() => setStartAttemptWarning(null), 3500);

        showToast(msg, "warning");
        return;
      }
      if (creditsRemaining !== null && creditsRemaining <= 0) {
        showToast("No recording credits. Please purchase more credits.", "error");
        setTimeout(() => navigate('/billing'), 2000);
        return;
      }

      try {
        chunksRef.current = [];
        resetTimer();
        resetTeleprompterPosition();
        mediaRecorder.start(250);
        setState("recording");
        setIsAutoPaused(false);
        setResumeCountdown(null);
        startTeleprompterScroll();
        startTimer();
      } catch (err) {
        console.error("Error starting recording:", err);
      }
      return;
    }

    if (state === "recording") {
      try {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setResumeCountdown(null);
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
        setIsAutoPaused(false);
      } catch (err) {
        console.error("Error stopping recording:", err);
      }
    }
  };

  const handleCancel = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setResumeCountdown(null);
    if (state === "recording") {
      if (!window.confirm("Stop recording and discard video?")) return;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.onstop = null; // Prevent upload or preview
        mediaRecorder.stop();
      }
    } else if (state === "preview") {
      if (!window.confirm("Discard recorded video and return to script?")) return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordedBlob(null);
    setIsAutoPaused(false);
    stopCamera();
    navigate(`/step2${mode ? `?mode=${mode}` : ''}`);
  };

  const handleRecordingStop = async () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setResumeCountdown(null);
    pauseTeleprompterScroll();
    pauseTimer();
    const durationSeconds = Math.max(1, elapsedSecondsRef.current);
    resetTimer();
    resetTeleprompterPosition();
    stopCamera();
    setIsAutoPaused(false);

    console.log("📹 Finalizing recording... Duration:", durationSeconds, "s");
    await new Promise((res) => setTimeout(res, 300));

    const rawBlob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];

    if (rawBlob.size === 0) {
      showToast("No video data captured. Please try recording again.", "error");
      setState("idle");
      setupCamera();
      return;
    }

    // ⏱️ Inject accurate duration metadata into WebM header for YouTube-style scrubbing
    const blob = await injectWebmDuration(rawBlob, durationSeconds);

    const url = URL.createObjectURL(blob);
    setRecordedBlob(blob);
    setPreviewUrl(url);
    setRecordedDuration(durationSeconds);
    setState("preview");
    showToast("Recording finished! Preview your video before uploading.", "info");
  };

  handleRecordingStopRef.current = handleRecordingStop;

  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setRecordedBlob(null);
    setRecordedDuration(0);
    resetTimer();
    resetTeleprompterPosition();
    setState("idle");
    setupCamera();
    showToast("Ready to re-record. Align your face to begin.", "info");
  };

  const handleApproveAndUpload = async () => {
    if (!recordedBlob) {
      showToast("No recorded video found to upload.", "error");
      return;
    }
    await uploadVideo(recordedBlob, recordedDuration);
  };


  const uploadVideo = async (blob: Blob, durationSeconds: number) => {
    setIsUploading(true);
    try {
      let currentUser = user;
      if (!currentUser) {
        const stored = localStorage.getItem("userData");
        if (stored) currentUser = JSON.parse(stored);
      }
      if (!currentUser) throw new Error("User session not found.");

      const jobRequestId = localStorage.getItem("current_job_request_id");
      if (!jobRequestId) throw new Error("Missing job request ID");

      const isCRMUser = localStorage.getItem("is_crm_user") === "true";
      const crmEmail = localStorage.getItem("crm_user_email");

      let activeJobRequestId = jobRequestId;
      if (!isSafeUUID(activeJobRequestId)) {
          console.warn("Non-UUID job request ID detected in Record.tsx. Creating a real record.");
          const jobTitle = "New Digital Resume";
          const jobDescription = localStorage.getItem("teleprompterText") || "Generated from resume analysis";
          if (isCRMUser && crmEmail) {
             const { data, error } = await supabase.from('crm_job_requests').insert([{
                email: crmEmail, user_id: currentUser.id, job_title: jobTitle, job_description: jobDescription, application_status: 'draft'
             }]).select('id').single();
             if (error) throw error;
             activeJobRequestId = data.id;
          } else {
             const { data, error } = await supabase.from('job_requests').insert([{
                user_id: currentUser.id, email: currentUser.email, job_title: jobTitle, job_description: jobDescription, status: 'draft'
             }]).select('id').single();
             if (error) throw error;
             activeJobRequestId = data.id;
          }
          localStorage.setItem('current_job_request_id', activeJobRequestId);
      }

      const fileName = `${Date.now()}.webm`;
      let publicUrl: string | null = null;

      if (isCRMUser && crmEmail) {
        const filePath = `${crmEmail}/${fileName}`;
        console.log("Generated filename:", fileName);
        console.log("Upload path:", filePath);

        const uploadResponse = await supabase.storage.from("CRM_users_recordings").upload(filePath, blob, { upsert: true, contentType: "video/webm" });
        console.log("Upload response:", uploadResponse);

        if (uploadResponse.error) {
          throw uploadResponse.error;
        }

        const dataPath = uploadResponse.data.path;
        console.log("data.path:", dataPath);

        publicUrl = supabase.storage.from("CRM_users_recordings").getPublicUrl(dataPath).data.publicUrl;
        console.log("Generated public URL:", publicUrl);

        const insertPayload = { email: crmEmail, user_id: currentUser.id, job_request_id: activeJobRequestId, video_url: publicUrl, duration: durationSeconds, file_size: blob.size, status: "completed" };
        console.log("Database insert payload (crm_recordings):", insertPayload);

        const { data: existingRecordings } = await supabase.from("crm_recordings").select("id").eq("job_request_id", activeJobRequestId);
        const existingRecording = existingRecordings && existingRecordings.length > 0 ? existingRecordings[0] : null;
        
        const writeResult = existingRecording
          ? await supabase.from("crm_recordings").update(insertPayload).eq("job_request_id", activeJobRequestId)
          : await supabase.from("crm_recordings").insert(insertPayload);

        if (writeResult.error) {
          console.error("crm_recordings write failed, retrying with required fields only:", writeResult.error);
          const minimalPayload = {
            email: crmEmail,
            user_id: currentUser.id,
            job_request_id: activeJobRequestId,
            video_url: publicUrl,
          };
          const retryResult = existingRecording
            ? await supabase.from("crm_recordings").update(minimalPayload).eq("job_request_id", activeJobRequestId)
            : await supabase.from("crm_recordings").insert(minimalPayload);
          if (retryResult.error) {
            console.error("crm_recordings minimal write failed:", retryResult.error);
          }
        }
        await supabase.from("crm_job_requests").update({ application_status: "recorded", updated_at: new Date().toISOString() }).eq("id", activeJobRequestId);

        if (!existingRecording && creditsRemaining !== null && creditsRemaining > 0) {
          await supabase.from('digital_resume_by_crm').update({ credits_remaining: creditsRemaining - 1 }).eq('email', crmEmail);
          setCreditsRemaining(prev => prev !== null ? prev - 1 : null);
        }
      } else {
        const filePath = `${currentUser.id}/${fileName}`;
        console.log("Generated filename:", fileName);
        console.log("Upload path:", filePath);

        const uploadResponse = await supabase.storage.from("recordings").upload(filePath, blob, { upsert: true, contentType: "video/webm" });
        console.log("Upload response:", uploadResponse);

        if (uploadResponse.error) {
          throw uploadResponse.error;
        }

        const dataPath = uploadResponse.data.path;
        console.log("data.path:", dataPath);

        publicUrl = supabase.storage.from("recordings").getPublicUrl(dataPath).data.publicUrl;
        console.log("Generated public URL:", publicUrl);

        const insertPayload = { job_request_id: activeJobRequestId, email: currentUser.email, storage_path: publicUrl, duration_seconds: durationSeconds, size_bytes: blob.size };
        console.log("Database insert payload (recordings):", insertPayload);

        const { data: existingRecordings } = await supabase.from("recordings").select("id").eq("job_request_id", activeJobRequestId);
        const existingRecording = existingRecordings && existingRecordings.length > 0 ? existingRecordings[0] : null;
        
        if (existingRecording) {
          await supabase.from("recordings").update(insertPayload).eq("job_request_id", activeJobRequestId);
        } else {
          await supabase.from("recordings").insert(insertPayload);
        }
        await supabase.from("job_requests").update({ status: "recorded", updated_at: new Date().toISOString() }).eq("id", activeJobRequestId);

        if (!existingRecording && creditsRemaining !== null && creditsRemaining > 0) {
          await supabase.from('profiles').update({ credits_remaining: creditsRemaining - 1 }).eq('id', currentUser.id);
          setCreditsRemaining(prev => prev !== null ? prev - 1 : null);
        }
      }

      showToast("Recording uploaded successfully!", "success");
      localStorage.setItem("recordedVideoUrl", publicUrl || "");
      navigate(`/final-result/${jobRequestId}?autoDownload=true`);
    } catch (err: any) {
      showToast(err.message || "Upload failed.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const recordingDisabled = !recorderReady || isUploading;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-0 sm:p-4">
      <div className="relative w-full max-w-[480px] h-screen sm:h-[640px] sm:max-h-[90vh] bg-black sm:rounded-2xl overflow-hidden shadow-2xl">
        {/* Live Camera Feed (Hidden during preview to free hardware, preserved in DOM for instant retake) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={state === "preview" ? "hidden" : "w-full h-full object-cover"}
        />

        {/* ============================================================ */}
        {/* 🎬 PREVIEW & REVIEW STATE                                     */}
        {/* ============================================================ */}
        {state === "preview" && previewUrl ? (
          <div className="absolute inset-0 w-full h-full flex flex-col bg-black z-30">
            {/* Top Review Header Bar */}
            <div className="px-4 py-3 bg-black/85 backdrop-blur-md flex items-center justify-between border-b border-white/10 z-40 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white text-xs font-semibold">Video Review</span>
                <span className="text-white/40 text-xs">|</span>
                <span className="text-emerald-300 text-xs font-medium">{formatTime(recordedDuration)}</span>
              </div>

              <button
                onClick={handleCancel}
                disabled={isUploading}
                className="p-1.5 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full border border-white/20 text-white shadow-md transition-all"
                title="Discard & Exit"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Viewport: Dedicated area where the video and its native scrubber bar sit cleanly */}
            <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center overflow-hidden">
              <video
                src={previewUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  if (!isFinite(video.duration) || isNaN(video.duration)) {
                    video.currentTime = 1e10;
                    const onTimeUpdate = () => {
                      video.removeEventListener('timeupdate', onTimeUpdate);
                      video.currentTime = 0;
                    };
                    video.addEventListener('timeupdate', onTimeUpdate);
                  } else {
                    video.currentTime = 0;
                  }
                }}
              />
            </div>

            {/* Bottom Action Footer: Completely separated below the video controls (Zero collision) */}
            <div className="p-3.5 sm:p-4 bg-slate-950/95 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-3 shrink-0 z-40">
              {/* Retake Button */}
              <button
                onClick={handleRetake}
                disabled={isUploading}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-medium text-xs sm:text-sm rounded-xl border border-white/20 shadow-lg transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4 text-slate-300" />
                <span>Retake</span>
              </button>

              {/* Approve & Upload Button */}
              <button
                onClick={handleApproveAndUpload}
                disabled={isUploading}
                className="flex-[1.6] flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Looks Good — Save & Upload</span>
                  </>
                )}
              </button>
            </div>

            {/* Uploading Fullscreen Modal Overlay */}
            {isUploading && (
              <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
                <h3 className="text-white font-bold text-lg mb-1">Saving Your Recording</h3>
                <p className="text-slate-300 text-xs max-w-xs">
                  Uploading video to cloud storage and generating your digital resume...
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================ */
          /* 🔴 LIVE RECORDING / IDLE STATE                                */
          /* ============================================================ */
          <>
            {/* Eye-level camera alignment reference - softened so it does not visually strike through text */}
            <div className="absolute top-[44%] left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/25 to-transparent pointer-events-none z-10" />

            {/* Unified Top Control Bar */}
            <div className="absolute top-4 inset-x-4 z-40 flex items-center justify-between gap-2 pointer-events-auto">
              {/* Left: Credits & Face Status Indicator */}
              <div className="flex items-center gap-2 flex-wrap">
                {creditsRemaining !== null && (
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-md">
                    <span className="text-white text-xs font-medium">
                      <span className={creditsRemaining > 0 ? "text-green-400" : "text-red-400"}>●</span> {creditsRemaining} credits
                    </span>
                  </div>
                )}

                {/* Live Face Status Pill */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all duration-300 border ${
                    isModelLoading
                      ? "bg-slate-900/70 text-slate-300 border-slate-600/30"
                      : alignmentStatus === "aligned"
                      ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                      : alignmentStatus === "not_centered"
                      ? "bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse shadow-[0_0_14px_rgba(245,158,11,0.35)]"
                      : "bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse shadow-[0_0_16px_rgba(244,63,94,0.4)]"
                  }`}
                >
                  {isModelLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking Camera...</span>
                    </>
                  ) : alignmentStatus === "aligned" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Face Aligned</span>
                    </>
                  ) : alignmentStatus === "not_centered" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>Center Face in Oval</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                      <span>Face Not Visible</span>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Speed, Timer & Cancel */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Speed Badge (Cleanly at the top so it never blocks script text) */}
                <div className="bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/20 text-white text-[11px] font-bold uppercase tracking-wider shadow-md">
                  <span>{teleprompterSpeed.toFixed(1)}x</span>
                </div>

                {/* Timer Badge */}
                <div className="flex items-center bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-white font-semibold text-xs shadow-md">
                  <span
                    className={`w-2 h-2 rounded-full mr-2 ${
                      state === "recording"
                        ? isAutoPaused
                          ? "bg-amber-400 animate-pulse"
                          : "bg-red-500 animate-pulse"
                        : "bg-gray-400"
                    }`}
                  />
                  <span ref={timerRef}>
                    {isUploading
                      ? "Uploading..."
                      : resumeCountdown !== null
                      ? `Resume ${resumeCountdown}s`
                      : isAutoPaused
                      ? `${timer} (Paused)`
                      : timer}
                  </span>
                </div>

                {/* Cancel Button */}
                <button
                  onClick={handleCancel}
                  className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full border border-white/20 text-white shadow-md transition-colors"
                  title="Cancel recording"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Face Guide & Centered Paused / Countdown Modal */}
            <FaceGuideOverlay
              guideRef={guideRef}
              isFaceDetected={isFaceDetected}
              isFaceAligned={isFaceAligned}
              alignmentStatus={alignmentStatus}
              isAutoPaused={isAutoPaused}
              resumeCountdown={resumeCountdown}
            />

            {/* Clean Teleprompter: Appears in the last second of countdown so user can prepare without clashing with initial countdown */}
            <div
              ref={teleprompterRef}
              className={`absolute top-[44%] left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] text-center px-4 py-8 pointer-events-none z-20 transition-opacity duration-300 ${
                isAutoPaused && resumeCountdown !== 1 ? "opacity-0" : "opacity-100"
              }`}
            >
              <div className="flex flex-col gap-6 pb-16">
                {teleprompterText.split(/\n\s*\n/).map((para, i) => (
                  <p
                    key={i}
                    className="text-white text-lg sm:text-2xl font-bold leading-relaxed tracking-wide"
                    style={{
                      textShadow:
                        "0 1px 3px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.85)",
                      WebkitTextStroke: "0.5px rgba(0,0,0,0.8)",
                    }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </div>

            {/* Friendly In-View Helper Feedback Pill directly above Record Button */}
            {state === "idle" && (
              <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-300">
                {alignmentStatus === "aligned" ? (
                  <div className="bg-emerald-950/90 backdrop-blur-md border border-emerald-500/50 text-emerald-300 text-xs font-semibold px-4 py-1.5 rounded-full shadow-[0_4px_16px_rgba(16,185,129,0.35)] flex items-center gap-1.5 whitespace-nowrap animate-in fade-in duration-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Ready — Tap button to start recording</span>
                  </div>
                ) : alignmentStatus === "not_centered" ? (
                  <div
                    className={`backdrop-blur-md border text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap transition-colors duration-200 ${
                      startAttemptWarning
                        ? "bg-amber-950/95 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.6)]"
                        : "bg-black/80 border-amber-500/60 text-amber-300 shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
                    }`}
                  >
                    <span className="text-amber-400 text-sm">⚠️</span>
                    <span>{startAttemptWarning || "Center face in oval to start recording"}</span>
                  </div>
                ) : (
                  <div
                    className={`backdrop-blur-md border text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap transition-colors duration-200 ${
                      startAttemptWarning
                        ? "bg-rose-950/95 border-rose-400 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.6)]"
                        : "bg-black/80 border-rose-500/60 text-rose-300 shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
                    }`}
                  >
                    <span className="text-rose-400 text-sm">⚠️</span>
                    <span>{startAttemptWarning || "Look into camera to start recording"}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleRecordClick}
              disabled={recordingDisabled}
              className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-4 flex items-center justify-center transition-colors z-40 ${
                shakeButton ? "ring-4 ring-amber-400/80" : ""
              } ${
                recordingDisabled
                  ? "opacity-40 border-white/40"
                  : state === "recording"
                  ? isAutoPaused
                    ? "bg-amber-500/30 border-amber-400 animate-pulse"
                    : "bg-white/10 border-white/85"
                  : alignmentStatus === "aligned"
                  ? "bg-red-500 border-white shadow-[0_0_25px_rgba(239,68,68,0.5)] cursor-pointer"
                  : alignmentStatus === "not_centered"
                  ? "bg-amber-500/80 border-amber-400/80 shadow-lg cursor-pointer"
                  : "bg-rose-500/70 border-rose-400/80 shadow-lg cursor-pointer"
              }`}
              title={
                state === "idle" && !isFaceAligned
                  ? alignmentStatus === "not_centered"
                    ? "Center face in oval to start recording"
                    : "Look into camera to start recording"
                  : ""
              }
            >
              {state === "recording" ? (
                <div className={`w-8 h-8 rounded-sm ${isAutoPaused ? "bg-amber-400" : "bg-red-600 animate-pulse"}`} />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white" />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Record;

