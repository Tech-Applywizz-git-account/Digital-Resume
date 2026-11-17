import React from "react";
import { AlertTriangle, UserCheck } from "lucide-react";
import { FaceAlignmentStatus } from "../../hooks/useFaceDetection";

interface FaceGuideOverlayProps {
  guideRef?: React.RefObject<HTMLDivElement>;
  isFaceDetected: boolean;
  isFaceAligned: boolean;
  alignmentStatus: FaceAlignmentStatus;
  isAutoPaused: boolean;
  resumeCountdown?: number | null;
}

export const FaceGuideOverlay: React.FC<FaceGuideOverlayProps> = ({
  guideRef,
  isFaceDetected,
  isFaceAligned,
  alignmentStatus,
  isAutoPaused,
  resumeCountdown,
}) => {
  const isCountingDown = typeof resumeCountdown === "number" && resumeCountdown > 0;

  return (
    <>
      {/* Centered Face Sketch / Oval Outline Guide (z-10: behind text during normal recording) */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center p-4 overflow-hidden select-none">
        <div
          ref={guideRef}
          className={`relative w-[210px] h-[270px] sm:w-[230px] sm:h-[290px] rounded-[50%] border-2 transition-all duration-300 flex items-center justify-center ${
            isCountingDown
              ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_35px_rgba(16,185,129,0.4)] scale-105"
              : alignmentStatus === "aligned"
              ? "border-emerald-400/50 bg-emerald-500/5 shadow-[0_0_16px_rgba(16,185,129,0.2)]"
              : alignmentStatus === "not_centered"
              ? "border-amber-400/80 bg-amber-500/10 animate-pulse shadow-[0_0_25px_rgba(245,158,11,0.35)]"
              : "border-rose-400/50 border-dashed bg-rose-950/15"
          }`}
        >
          {/* If Counting down to resume: Show animated numbers inside the oval */}
          {isCountingDown ? (
            <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-200">
              <span className="text-4xl font-extrabold text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]">
                {resumeCountdown}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 mt-1">
                Resuming...
              </span>
            </div>
          ) : (
            /* Center crosshair dot */
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                alignmentStatus === "aligned"
                  ? "bg-emerald-400"
                  : alignmentStatus === "not_centered"
                  ? "bg-amber-400"
                  : "bg-white/20"
              }`}
            />
          )}

          {/* Framing corner brackets */}
          <div className="absolute top-4 left-6 w-3 h-3 border-t-2 border-l-2 border-white/30 rounded-tl" />
          <div className="absolute top-4 right-6 w-3 h-3 border-t-2 border-r-2 border-white/30 rounded-tr" />
          <div className="absolute bottom-4 left-6 w-3 h-3 border-b-2 border-l-2 border-white/30 rounded-bl" />
          <div className="absolute bottom-4 right-6 w-3 h-3 border-b-2 border-r-2 border-white/30 rounded-br" />
        </div>
      </div>

      {/* Auto-Paused Modal Alert when face is out of position (top-level z-50, clearly on top) */}
      {isAutoPaused && !isCountingDown && (
        <div className="absolute inset-x-6 top-[56%] -translate-y-1/2 z-50 bg-black/95 backdrop-blur-md border border-amber-500/60 rounded-2xl p-5 shadow-2xl text-center pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="w-10 h-10 mx-auto mb-2.5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
            {alignmentStatus === "not_centered" ? (
              <UserCheck className="w-6 h-6 animate-pulse" />
            ) : (
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            )}
          </div>
          <h3 className="text-white font-bold text-base sm:text-lg">Recording Paused</h3>
          <p className="text-gray-300 text-xs sm:text-sm mt-1.5 leading-relaxed">
            {alignmentStatus === "not_centered"
              ? "Please position your face inside the center oval outline to continue recording."
              : "Face not visible. Please look into the camera to continue recording."}
          </p>
        </div>
      )}
    </>
  );
};
