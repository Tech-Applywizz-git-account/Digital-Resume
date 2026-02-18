import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { showToast } from "../components/ui/toast";
import { getUserInfo } from "../utils/crmHelpers";

const Record: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recorderReady, setRecorderReady] = useState(false);
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [timer, setTimer] = useState("0:00");
  const [startTime, setStartTime] = useState<number>(0);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [teleprompterText, setTeleprompterText] = useState("");
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const MAX_RECORDING_SECONDS = 150; // 2.5 minutes

  // 🔹 Load teleprompter text
  useEffect(() => {
    const text =
      localStorage.getItem("teleprompterText") ||
      "Please complete Step 3 to generate your introduction script.";
    setTeleprompterText(text);
  }, []);

  // 🔹 Check user credits on mount (CRM Aware)
  useEffect(() => {
    const checkCredits = async () => {
      if (!user) return;

      setCheckingCredits(true);
      try {
        // Check if CRM user
        const isCRMUser = localStorage.getItem("is_crm_user") === "true";
        const crmEmail = localStorage.getItem("crm_user_email");

        if (isCRMUser && crmEmail) {
          // Check CRM credits
          const { data, error } = await supabase
            .from('digital_resume_by_crm')
            .select('credits_remaining')
            .eq('email', crmEmail)
            .single();

          if (error) {
            console.error('Error fetching CRM credits:', error);
            return;
          }

          setCreditsRemaining(data?.credits_remaining ?? 0);
          console.log('📊 CRM User credits:', data?.credits_remaining);
        } else {
          // Check regular user credits
          const { data, error } = await supabase
            .from('profiles')
            .select('credits_remaining')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error fetching credits:', error);
            return;
          }

          setCreditsRemaining(data?.credits_remaining ?? 0);
          console.log('📊 User credits:', data?.credits_remaining);
        }
      } catch (err) {
        console.error('Error checking credits:', err);
      } finally {
        setCheckingCredits(false);
      }
    };

    checkCredits();
  }, [user]);

  // ------------------------------------------
  // Camera + Recorder Initialization
  // ------------------------------------------
  const setupCamera = async () => {
    try {
      setIsInitializing(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 }, // Set to 720p as requested
          height: { ideal: 720 },
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
        // Ensure camera is on initially
        stream.getVideoTracks().forEach((track) => (track.enabled = true));
      }

      await new Promise((r) => setTimeout(r, 800)); // small wait for tracks

      const mimeType = MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp8,opus"
      )
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";

      let recorder: MediaRecorder;

      // Optimize bitrate to prevent hitting 50MB limit too quickly
      // 2.5 Mbps provides excellent quality for intro videos while doubling allowed duration
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 2500000, // Reduced from 5Mbps to 2.5Mbps
          audioBitsPerSecond: 128000,
        });
      } catch {
        // Fallback if browser doesn't like bitrate options
        recorder = new MediaRecorder(stream, { mimeType });
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = handleRecordingStop;
      recorder.onerror = (err) => console.error("⚠️ Recorder error:", err);

      setMediaRecorder(recorder);
      setRecorderReady(true);
      console.log("✅ MediaRecorder ready:", mimeType);
      setIsInitializing(false);
      return recorder;
    } catch (err) {
      console.error("🚫 Camera/Mic access failed:", err);
      showToast(
        "Please allow camera and microphone access to record.",
        "error"
      );
      setRecorderReady(false);
      setIsInitializing(false);
      return null;
    }
  };

  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

      // stop camera tracks on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔹 Timer
  const startTimer = () => {
    const start = Date.now();
    setStartTime(start);
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = MAX_RECORDING_SECONDS - elapsed;

      const minutes = Math.floor(elapsed / 60);
      setTimer(`${minutes}:${String(elapsed % 60).padStart(2, "0")}`);
      setTimeRemaining(remaining > 0 ? remaining : 0);

      // Auto-stop at 150s
      if (elapsed >= MAX_RECORDING_SECONDS) {
        clearInterval(interval);
        handleRecordClick(); // This will trigger the stop logic
      }
    }, 1000);
    timerIntervalRef.current = interval;
  };

  const resetTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimer("0:00");
    setTimeRemaining(null);
  };

  // 🔹 Teleprompter scroll
  const startTeleprompterScroll = () => {
    let y = 100; // starts below Record button
    const speed = parseFloat(localStorage.getItem("teleprompterSpeed") || "1");
    const interval = setInterval(() => {
      y -= 0.08 * speed;
      if (teleprompterRef.current) {
        teleprompterRef.current.style.transform = `translate(-50%, ${y}%)`;
      }
      if (y < -300) {
        if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      }
    }, 40);
    scrollIntervalRef.current = interval;
  };

  const resetTeleprompterPosition = () => {
    if (teleprompterRef.current) {
      teleprompterRef.current.style.transform = "translate(-50%, 0%)";
    }
  };

  // 🔹 Start/Stop Recording (single-click toggle)
  const handleRecordClick = async () => {
    // START recording
    if (state === "idle") {
      let currentRecorder = mediaRecorder;

      // Initialize camera ONLY when user clicks Record
      if (!currentRecorder) {
        currentRecorder = await setupCamera();
        if (!currentRecorder) return;
      }

      // Check credits before starting recording
      if (creditsRemaining !== null && creditsRemaining <= 0) {
        showToast(
          "You have no recording credits. Please purchase more credits to continue.",
          "error"
        );
        // Redirect to billing after 2 seconds
        setTimeout(() => {
          navigate('/billing');
        }, 2000);
        return;
      }

      try {
        chunksRef.current = [];
        setStartTime(Date.now());
        currentRecorder.start(250); // gather data every 250ms
        console.log("🎥 Recording started");
        setState("recording");
        startTeleprompterScroll();
        startTimer();
      } catch (err) {
        console.error("Error starting recording:", err);
      }
      return;
    }

    // STOP recording
    if (state === "recording") {
      try {
        if (mediaRecorder) {
          mediaRecorder.requestData();
          mediaRecorder.stop();
        }
        console.log("🛑 Recording stopped:", Date.now());
        setState("idle");
      } catch (err) {
        console.error("Error stopping recording:", err);
      }
    }
  };

  // 🔹 When Recording Stops
  const handleRecordingStop = async () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    resetTimer();
    resetTeleprompterPosition();

    // Turn camera off COMPLETELY (light goes off)
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setMediaRecorder(null);
    setRecorderReady(false);

    console.log("📹 Finalizing recording...");
    await new Promise((res) => setTimeout(res, 300));

    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = []; // reset for next run
    console.log("🎞️ Blob created:", blob.size, "bytes");

    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - startTime) / 1000)
    );
    console.log("⏱ Duration:", durationSeconds, "seconds");

    if (blob.size === 0) {
      showToast(
        "No video data captured. Please check your camera and mic.",
        "error"
      );
      return;
    }

    // ✅ Fade effect for smooth UX
    if (videoRef.current) {
      videoRef.current.classList.add(
        "opacity-80",
        "transition-opacity",
        "duration-700"
      );
      setTimeout(
        () => videoRef.current?.classList.remove("opacity-80"),
        1000
      );
    }

    await uploadVideo(blob, durationSeconds);

    // ✅ Reinitialize Recorder for next recording
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const mimeType = MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp8,opus"
      )
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";
      let newRecorder: MediaRecorder;
      try {
        newRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 2500000, // Optimized bitrate
          audioBitsPerSecond: 128_000,
        });
      } catch {
        newRecorder = new MediaRecorder(stream, { mimeType });
      }
      newRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      newRecorder.onstop = handleRecordingStop;
      newRecorder.onerror = (err) => console.error("⚠️ Recorder error:", err);
      setMediaRecorder(newRecorder);
      setRecorderReady(true);
      console.log("🔁 MediaRecorder reinitialized");
    }
  };

  // 🔹 Upload to Supabase (CRM Aware)
  const uploadVideo = async (blob: Blob, durationSeconds: number) => {
    setIsUploading(true);
    try {
      if (!user) throw new Error("User not signed in");

      const jobRequestId = localStorage.getItem("current_job_request_id");
      if (!jobRequestId) throw new Error("Missing job request ID");

      // Check if CRM user
      const isCRMUser = localStorage.getItem("is_crm_user") === "true";
      const crmEmail = localStorage.getItem("crm_user_email");

      const fileName = `${Date.now()}.webm`;
      let publicUrl: string | null = null;

      // Supabase default limit is usually 50MB
      const fiftyMB = 50 * 1024 * 1024;
      if (blob.size > fiftyMB) {
        throw new Error("Video too large! Please record a shorter video (maximum 2.5 minutes).");
      }

      if (isCRMUser && crmEmail) {
        // CRM User - Upload to CRM bucket
        const filePath = `${crmEmail}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("CRM_users_recordings")
          .upload(filePath, blob, {
            upsert: true,
            contentType: "video/webm",
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("CRM_users_recordings")
          .getPublicUrl(filePath);
        publicUrl = publicData?.publicUrl;

        // Save to crm_recordings table
        const { error: insertError } = await supabase.from("crm_recordings").insert({
          email: crmEmail,
          user_id: user.id,
          job_request_id: jobRequestId,
          video_url: publicUrl,
          duration: durationSeconds,
          file_size: blob.size,
          status: "completed",
        });

        if (insertError) throw insertError;

        // Update crm_job_requests
        const { error: updateError } = await supabase
          .from("crm_job_requests")
          .update({
            application_status: "recorded",
            updated_at: new Date().toISOString()
          })
          .eq("id", jobRequestId);

        if (updateError) throw updateError;

        // Decrement CRM credits
        if (creditsRemaining !== null && creditsRemaining > 0) {
          const { error: creditError } = await supabase
            .from('digital_resume_by_crm')
            .update({ credits_remaining: creditsRemaining - 1 })
            .eq('email', crmEmail);

          if (creditError) {
            console.error("Error decrementing CRM credits:", creditError);
          } else {
            setCreditsRemaining(creditsRemaining - 1);
          }
        }
      } else {
        // Regular User - Upload to regular bucket
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("recordings")
          .upload(filePath, blob, {
            upsert: true,
            contentType: "video/webm",
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("recordings")
          .getPublicUrl(filePath);
        publicUrl = publicData?.publicUrl;

        const { error: insertError } = await supabase.from("recordings").insert({
          job_request_id: jobRequestId,
          email: user.email, // Add email to satisfy foreign key constraint
          storage_path: publicUrl,
          duration_seconds: durationSeconds,
          size_bytes: blob.size,
        });

        if (insertError) throw insertError;

        const { error: updateError } = await supabase
          .from("job_requests")
          .update({ status: "recorded", updated_at: new Date().toISOString() })
          .eq("id", jobRequestId);

        if (updateError) throw updateError;

        // Decrement regular user credits
        if (creditsRemaining !== null && creditsRemaining > 0) {
          const { error: creditError } = await supabase
            .from('profiles')
            .update({ credits_remaining: creditsRemaining - 1 })
            .eq('id', user.id);

          if (creditError) {
            console.error("Error decrementing credits:", creditError);
          } else {
            setCreditsRemaining(creditsRemaining - 1);
          }
        }
      }

      console.log("✅ Uploaded:", publicUrl);
      showToast("Recording uploaded successfully!", "success");
      localStorage.setItem("recordedVideoUrl", publicUrl || "");

      navigate(`/final-result/${jobRequestId}`);
    } catch (err: any) {
      console.error("❌ Upload failed:", err.message);

      // Check if error is related to insufficient credits
      if (err.message && err.message.toLowerCase().includes('insufficient credits')) {
        showToast(
          "Insufficient credits. Please purchase more credits to create recordings.",
          "error"
        );
        // Redirect to billing
        setTimeout(() => {
          navigate('/billing');
        }, 2000);
      } else if (err.message && (err.message.toLowerCase().includes('size') || err.message.toLowerCase().includes('too large'))) {
        showToast(
          "Upload failed: File exceeds 50MB storage limit. Please record a shorter video.",
          "error"
        );
      } else {
        showToast(
          err.message || "Upload failed. Please try again.",
          "error"
        );
      }
    } finally {
      setIsUploading(false);
    }
  };

  const recordingDisabled = isUploading || isInitializing;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="relative w-full max-w-[480px] h-[640px] bg-black rounded-2xl overflow-hidden shadow-2xl">
        {/* Camera Preview */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Guide Line */}
        <div className="absolute top-[44%] left-0 right-0 h-0.5 bg-blue-400 bg-opacity-60" />

        {/* Credits Indicator */}
        {creditsRemaining !== null && (
          <div className="absolute top-3 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
            <span className="text-white text-sm font-medium">
              {creditsRemaining > 0 ? (
                <>
                  <span className="text-green-400">●</span> {creditsRemaining} {creditsRemaining === 1 ? 'credit' : 'credits'}
                </>
              ) : (
                <>
                  <span className="text-red-400">●</span> No credits
                </>
              )}
            </span>
          </div>
        )}

        {/* Timer / Status */}
        <div className="absolute top-3 right-4 text-white font-semibold text-xl flex items-center">
          <span
            className={`w-2 h-2 rounded-full mr-2 ${state === "recording" ? "bg-red-500" : (isInitializing ? "bg-yellow-400 animate-pulse" : "bg-gray-400")
              }`}
          />
          <span ref={timerRef} className="flex flex-col items-end">
            <span className="text-white">{isUploading ? "Uploading..." : (isInitializing ? "Starting Camera..." : timer)}</span>
            {state === "recording" && timeRemaining !== null && (
              <span className={`text-xs font-normal ${timeRemaining < 10 ? 'text-red-500 animate-pulse' : 'text-white/60'}`}>
                {timeRemaining}s left
              </span>
            )}
          </span>
        </div>

        {/* Teleprompter */}
        <div
          ref={teleprompterRef}
          className="absolute bottom-[8rem] left-1/2 transform -translate-x-1/2 
             w-[100%] text-white font-sans text-xl md:text-2xl leading-relaxed 
             font-medium text-center bg-gradient-to-b from-black/80 to-black/40 
             px-6 py-8 rounded-lg pointer-events-none overflow-hidden"
        >
          <div className="flex flex-col gap-6 pb-10">
            {teleprompterText.split(/\n\s*\n/).map((para, i) => (
              <p key={i} className="whitespace-pre-line">
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* Record Button – single-click toggle */}
        <button
          onClick={handleRecordClick}
          disabled={recordingDisabled}
          className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full 
            border-4 border-white/85 cursor-pointer transition-all duration-200 
            flex items-center justify-center
            ${recordingDisabled
              ? "opacity-60 cursor-not-allowed"
              : state === "recording"
                ? "bg-red-500 shadow-[0_0_0_6px_rgba(255,59,48,0.35),0_0_24px_rgba(255,59,48,0.8)]"
                : "bg-red-500 hover:scale-105 active:scale-95"
            }`}
        >
          {/* inner dot for nicer UI */}
          <div
            className={`w-8 h-8 rounded-full ${state === "recording" ? "bg-white" : "bg-white/90"
              } transition-all duration-300 ${state === "recording" ? "rounded-md scale-75" : "rounded-full"}`}
          />
        </button>
      </div>
    </div>
  );
};

export default Record;
