import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { showToast } from "../components/ui/toast";
import { X, Loader2 } from "lucide-react";

/**
 * Enhanced Camera/Recorder Page
 * Ensures hardware is released properly upon completion or navigation.
 */
const Record: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = new URLSearchParams(location.search).get('mode');
  const { user } = useAuth();

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recorderReady, setRecorderReady] = useState(false);
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [timer, setTimer] = useState("0:00");
  const [startTime, setStartTime] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [teleprompterText, setTeleprompterText] = useState("");
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(1.0);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);

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

  const resetTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimer("0:00");
  };

  const resetTeleprompterPosition = () => {
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

  // 🔹 Camera + Recorder Initialization
  useEffect(() => {
    let isMounted = true;

    const setupCamera = async () => {
      try {
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

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play();
          streamRef.current = stream;
          stream.getVideoTracks().forEach((track) => (track.enabled = true));
        }

        await new Promise((r) => setTimeout(r, 800)); // small wait for tracks
        if (!isMounted) return;

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
        recorder.onstop = handleRecordingStop;
        recorder.onerror = (err) => console.error("⚠️ Recorder error:", err);

        setMediaRecorder(recorder);
        setRecorderReady(true);
      } catch (err) {
        console.error("🚫 Camera/Mic access failed:", err);
        if (isMounted) {
          showToast("Please allow camera and microphone access, then reload the page.", "error");
          setRecorderReady(false);
        }
      }
    };

    setupCamera();

    return () => {
      isMounted = false;
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopCamera();
    };
  }, []);

  // ------------------------------------------
  // Recording Handlers
  // ------------------------------------------

  const handleRecordClick = async () => {
    if (!mediaRecorder) return;

    if (state === "idle") {
      if (creditsRemaining !== null && creditsRemaining <= 0) {
        showToast("No recording credits. Please purchase more credits.", "error");
        setTimeout(() => navigate('/billing'), 2000);
        return;
      }
      try {
        chunksRef.current = [];
        setStartTime(Date.now());
        mediaRecorder.start(250);
        setState("recording");
        startTeleprompterScroll();
        startTimer();
      } catch (err) {
        console.error("Error starting recording:", err);
      }
      return;
    }

    if (state === "recording") {
      try {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
        setState("idle");
      } catch (err) {
        console.error("Error stopping recording:", err);
      }
    }
  };

  const handleCancel = () => {
    if (state === "recording") {
      if (!window.confirm("Stop recording and discard video?")) return;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.onstop = null; // Prevent upload
        mediaRecorder.stop();
      }
    }
    stopCamera();
    navigate(`/step2${mode ? `?mode=${mode}` : ''}`);
  };

  const handleRecordingStop = async () => {
    if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    resetTimer();
    resetTeleprompterPosition();
    stopCamera();

    console.log("📹 Finalizing recording...");
    await new Promise((res) => setTimeout(res, 300));

    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];

    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    if (blob.size === 0) {
      showToast("No video data captured.", "error");
      return;
    }
    await uploadVideo(blob, durationSeconds);
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
      const fileName = `${Date.now()}.webm`;
      let publicUrl: string | null = null;

      if (isCRMUser && crmEmail) {
        const filePath = `${crmEmail}/${fileName}`;
        await supabase.storage.from("CRM_users_recordings").upload(filePath, blob, { upsert: true, contentType: "video/webm" });
        publicUrl = supabase.storage.from("CRM_users_recordings").getPublicUrl(filePath).data.publicUrl;

        const { data: existingRecording } = await supabase.from("crm_recordings").select("id").eq("job_request_id", jobRequestId).maybeSingle();
        await supabase.from("crm_recordings").insert({ email: crmEmail, user_id: currentUser.id, job_request_id: jobRequestId, video_url: publicUrl, duration: durationSeconds, file_size: blob.size, status: "completed" });
        await supabase.from("crm_job_requests").update({ application_status: "recorded", updated_at: new Date().toISOString() }).eq("id", jobRequestId);

        if (!existingRecording && creditsRemaining !== null && creditsRemaining > 0) {
          await supabase.from('digital_resume_by_crm').update({ credits_remaining: creditsRemaining - 1 }).eq('email', crmEmail);
          setCreditsRemaining(prev => prev !== null ? prev - 1 : null);
        }
      } else {
        const filePath = `${currentUser.id}/${fileName}`;
        await supabase.storage.from("recordings").upload(filePath, blob, { upsert: true, contentType: "video/webm" });
        publicUrl = supabase.storage.from("recordings").getPublicUrl(filePath).data.publicUrl;

        const { data: existingRecording } = await supabase.from("recordings").select("id").eq("job_request_id", jobRequestId).maybeSingle();
        await supabase.from("recordings").insert({ job_request_id: jobRequestId, email: currentUser.email, storage_path: publicUrl, duration_seconds: durationSeconds, size_bytes: blob.size });
        await supabase.from("job_requests").update({ status: "recorded", updated_at: new Date().toISOString() }).eq("id", jobRequestId);

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

  const startTimer = () => {
    const start = Date.now();
    setStartTime(start);
    timerIntervalRef.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(seconds / 60);
      setTimer(`${m}:${String(seconds % 60).padStart(2, "0")}`);
    }, 1000);
  };

  const startTeleprompterScroll = () => {
    let y = 0;
    const speed = parseFloat(localStorage.getItem("teleprompterSpeed") || "1");
    scrollIntervalRef.current = setInterval(() => {
      y -= 0.08 * speed;
      if (teleprompterRef.current) teleprompterRef.current.style.transform = `translate(-50%, ${y}%)`;
      if (y < -200) clearInterval(scrollIntervalRef.current!);
    }, 40);
  };

  const recordingDisabled = !recorderReady || isUploading;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-0 sm:p-4">
      <div className="relative w-full max-w-[480px] h-screen sm:h-[640px] sm:max-h-[90vh] bg-black sm:rounded-2xl overflow-hidden shadow-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="absolute top-[44%] left-0 right-0 h-0.5 bg-blue-400 bg-opacity-60" />

        {creditsRemaining !== null && (
          <div className="absolute top-3 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
            <span className="text-white text-sm font-medium">
              <span className={creditsRemaining > 0 ? "text-green-400" : "text-red-400"}>●</span> {creditsRemaining} credits
            </span>
          </div>
        )}

        {/* Speed Indicator */}
        <div className="absolute top-[35%] right-4 z-40">
          <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
            <span className="text-white text-[10px] font-normal uppercase tracking-wider">Speed: {teleprompterSpeed.toFixed(1)}x</span>
          </div>
        </div>

        <div className="absolute top-3 right-4 text-white font-semibold flex items-center gap-3">
          <div className="flex items-center">
            <span className={`w-2 h-2 rounded-full mr-2 ${state === "recording" ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
            <span ref={timerRef}>{isUploading ? "Uploading..." : timer}</span>
          </div>
          <button onClick={handleCancel} className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full border border-white/20"><X className="w-5 h-5 text-white" /></button>
        </div>

        <div ref={teleprompterRef} className="absolute top-[44%] left-1/2 transform -translate-x-1/2 w-[100%] text-white text-lg sm:text-2xl font-medium text-center px-6 py-8 pointer-events-none">
          <div className="flex flex-col gap-6 pb-10">
            {teleprompterText.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </div>

        <button onClick={handleRecordClick} disabled={recordingDisabled} className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-4 border-white/85 flex items-center justify-center transition-all ${recordingDisabled ? "opacity-40" : state === "recording" ? "bg-white/10" : "bg-red-500 shadow-lg"}`}>
          {state === "recording" ? <div className="w-8 h-8 bg-red-600 rounded-sm animate-pulse" /> : <div className="w-8 h-8 rounded-full bg-white" />}
        </button>
      </div>
    </div>
  );
};

export default Record;
