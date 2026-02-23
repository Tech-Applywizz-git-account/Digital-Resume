import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { showToast } from "../components/ui/toast";
import { getUserInfo } from "../utils/crmHelpers";
import { FileText, MessageSquare } from "lucide-react";

const Record: React.FC = () => {
  const navigate = useNavigate();
  const { id: castId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isIntentionalStop = useRef(false);

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recorderReady, setRecorderReady] = useState(false);
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [timer, setTimer] = useState("0:00");
  const [startTime, setStartTime] = useState<number>(0);
  const [scrollInterval, setScrollInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [teleprompterText, setTeleprompterText] = useState("");
  const [resumeFullText, setResumeFullText] = useState("");
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"teleprompter" | "resume">(castId ? "resume" : "teleprompter");
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const creditsRef = useRef<number | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);

  // Sync ref with state
  useEffect(() => {
    creditsRef.current = creditsRemaining;
  }, [creditsRemaining]);

  // 🔹 Load teleprompter text & resume text
  useEffect(() => {
    const loadData = async () => {
      // 1. Load defaults from localStorage
      const text = localStorage.getItem("teleprompterText") || "Please complete Step 3 to generate your introduction script.";
      setTeleprompterText(text);
      setResumeFullText(localStorage.getItem("resumeFullText") || "");

      // 2. If castId from URL, fetch latest from DB
      if (castId) {
        try {
          // Check CRM job requests
          const { data: crmData } = await supabase.from('crm_job_requests').select('job_title, resume_url').eq('id', castId).maybeSingle();
          const { data: regData } = await supabase.from('job_requests').select('job_title, resume_path').eq('id', castId).maybeSingle();

          const latestResumeUrl = crmData?.resume_url || regData?.resume_path;
          if (latestResumeUrl) {
            setResumeUrl(latestResumeUrl);
            localStorage.setItem("uploadedResumeUrl", latestResumeUrl);
            localStorage.setItem("current_job_request_id", castId);

            // Also try to find a direct resume metadata record if available
            const { data: resumeRecord } = await supabase
              .from('crm_resumes')
              .select('resume_url, resume_name')
              .eq('email', localStorage.getItem('crm_user_email'))
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (resumeRecord?.resume_url) {
              setResumeUrl(resumeRecord.resume_url);
              localStorage.setItem("uploadedResumeUrl", resumeRecord.resume_url);
            }
          }
        } catch (err) {
          console.error("Error loading cast data:", err);
        }
      } else {
        setResumeUrl(localStorage.getItem("uploadedResumeUrl"));
      }
    };
    loadData();
  }, [castId]);

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
            .eq('id', currentUser.id)
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
  useEffect(() => {
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

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play();
          streamRef.current = stream; // Keep track of stream for cleanup
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

        try {
          recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 5000000,
            audioBitsPerSecond: 128_000,
          });
        } catch {
          // Fallback if browser doesn't like bitrate options
          recorder = new MediaRecorder(stream, { mimeType });
        }

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => onStopRef.current?.();
        recorder.onerror = (err) => console.error("⚠️ Recorder error:", err);

        setMediaRecorder(recorder);
        setRecorderReady(true);
        console.log("✅ MediaRecorder ready:", mimeType);
      } catch (err) {
        console.error("🚫 Camera/Mic access failed:", err);
        showToast(
          "Please allow camera and microphone access, then reload the page.",
          "error"
        );
        setRecorderReady(false);
      }
    };

    setupCamera();

    // Cleanup
    return () => {
      if (scrollInterval) clearInterval(scrollInterval);
      if (timerInterval) clearInterval(timerInterval);

      // stop camera tracks on unmount using ref for reliability
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔹 Timer
  const startTimer = () => {
    const start = Date.now();
    setStartTime(start);
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - start) / 1000);
      const minutes = Math.floor(seconds / 60);
      setTimer(`${minutes}:${String(seconds % 60).padStart(2, "0")}`);
    }, 1000);
    setTimerInterval(interval);
  };

  const resetTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    setTimer("0:00");
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
      if (y < -200) {
        clearInterval(interval);
      }
    }, 40);
    setScrollInterval(interval);
  };

  const resetTeleprompterPosition = () => {
    if (teleprompterRef.current) {
      teleprompterRef.current.style.transform = "translate(-50%, 0%)";
    }
  };

  // 🔹 Start/Stop Recording (single-click toggle)
  const handleRecordClick = async () => {
    if (!mediaRecorder) return;

    // START recording
    if (state === "idle") {
      const currentCredits = creditsRef.current;
      if (currentCredits !== null && currentCredits <= 0) {
        showToast(
          "You have no recording credits. Please purchase more credits to continue.",
          "error"
        );
        setTimeout(() => navigate('/billing'), 2000);
        return;
      }
      try {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getVideoTracks().forEach((track) => (track.enabled = true));
        }

        chunksRef.current = [];
        isIntentionalStop.current = false;
        setStartTime(Date.now());
        mediaRecorder.start(250);
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
        mediaRecorder.requestData();
        isIntentionalStop.current = true;
        mediaRecorder.stop();
        console.log("🛑 Recording stopped:", Date.now());
        setState("idle");
      } catch (err) {
        console.error("Error stopping recording:", err);
      }
    }
  };

  // 🔹 Stabilize handleRecordingStop for onstop callback
  const onStopRef = useRef<() => void>();
  useEffect(() => {
    onStopRef.current = handleRecordingStop;
  });

  // 🔹 When Recording Stops
  const handleRecordingStop = async () => {
    console.log("🎬 onstop fired. isIntentionalStop:", isIntentionalStop.current);

    if (!isIntentionalStop.current) {
      console.log("🚫 Recording stop ignored (unintentional navigation or back click)");
      return;
    }

    // Immediately reset intentional stop to prevent double calls
    isIntentionalStop.current = false;

    if (scrollInterval) clearInterval(scrollInterval);
    if (timerInterval) clearInterval(timerInterval);
    resetTimer();
    resetTeleprompterPosition();

    // Turn camera off completely
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    console.log("📹 Finalizing recording...");
    await new Promise((res) => setTimeout(res, 300));

    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];
    console.log("🎞️ Blob created:", blob.size, "bytes");

    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - startTime) / 1000)
    );

    if (blob.size === 0) {
      showToast(
        "No video data captured. Please check your camera and mic.",
        "error"
      );
      return;
    }

    // Protection: don't deduct credits for extremely short accidental recordings
    if (durationSeconds < 2) {
      console.log("⚠️ Recording too short ( < 2s). Ignoring.");
      showToast("Recording was too short. Please try again.", "warning");
      setRecorderReady(false);
      setTimeout(() => window.location.reload(), 1500);
      return;
    }

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
    setRecorderReady(false);
  };

  // 🔹 Upload to Supabase (CRM Aware)
  const uploadVideo = async (blob: Blob, durationSeconds: number) => {
    setIsUploading(true);
    try {
      let currentUser = user;
      if (!currentUser) {
        const storedUser = localStorage.getItem("userData");
        if (storedUser) currentUser = JSON.parse(storedUser);
      }

      if (!currentUser) throw new Error("User session not found. Please sign in again.");

      const jobRequestId = localStorage.getItem("current_job_request_id");
      if (!jobRequestId) throw new Error("Missing job request ID");

      const isCRMUser = localStorage.getItem("is_crm_user") === "true";
      const crmEmail = localStorage.getItem("crm_user_email");

      const fileName = `${Date.now()}.webm`;
      let publicUrl: string | null = null;
      const maxUploadSize = 500 * 1024 * 1024;
      if (blob.size > maxUploadSize) {
        throw new Error("Video too large!");
      }

      if (isCRMUser && crmEmail) {
        const filePath = `${crmEmail}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("CRM_users_recordings")
          .upload(filePath, blob, { upsert: true, contentType: "video/webm" });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("CRM_users_recordings")
          .getPublicUrl(filePath);
        publicUrl = publicData?.publicUrl;

        await supabase.from("crm_recordings").insert({
          email: crmEmail,
          user_id: currentUser.id,
          job_request_id: jobRequestId,
          video_url: publicUrl,
          duration: durationSeconds,
          file_size: blob.size,
          status: "completed",
        });

        await supabase.from("crm_job_requests")
          .update({ application_status: "recorded", updated_at: new Date().toISOString() })
          .eq("id", jobRequestId);

        const currentCredits = creditsRef.current;
        if (currentCredits !== null && currentCredits > 0) {
          await supabase.from('digital_resume_by_crm')
            .update({ credits_remaining: currentCredits - 1 })
            .eq('email', crmEmail);
          setCreditsRemaining(currentCredits - 1);
        }
      } else {
        const filePath = `${currentUser.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("recordings")
          .upload(filePath, blob, { upsert: true, contentType: "video/webm" });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("recordings")
          .getPublicUrl(filePath);
        publicUrl = publicData?.publicUrl;

        await supabase.from("recordings").insert({
          job_request_id: jobRequestId,
          email: currentUser.email,
          storage_path: publicUrl,
          duration_seconds: durationSeconds,
          size_bytes: blob.size,
        });

        await supabase.from("job_requests")
          .update({ status: "recorded", updated_at: new Date().toISOString() })
          .eq("id", jobRequestId);

        const currentCredits = creditsRef.current;
        if (currentCredits !== null && currentCredits > 0) {
          await supabase.from('profiles')
            .update({ credits_remaining: currentCredits - 1 })
            .eq('id', currentUser.id);
          setCreditsRemaining(currentCredits - 1);
        }
      }

      showToast("Recording uploaded successfully!", "success");
      localStorage.setItem("recordedVideoUrl", publicUrl || "");
      navigate(`/final-result/${jobRequestId}`);
    } catch (err: any) {
      console.error("❌ Upload failed:", err.message);
      showToast(err.message || "Upload failed. Please try again.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const recordingDisabled = !recorderReady || isUploading;

  const handleBack = () => {
    isIntentionalStop.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    const isAdmin = sessionStorage.getItem('digital_resume_admin_access') === 'true';
    navigate(isAdmin ? "/digital-resume-dashboard" : "/dashboard");
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <button
        onClick={handleBack}
        className="absolute top-6 left-6 z-50 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <div className="relative w-full max-w-[480px] h-[640px] bg-black rounded-2xl overflow-hidden shadow-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="absolute top-[44%] left-0 right-0 h-0.5 bg-blue-400 bg-opacity-60" />
        {creditsRemaining !== null && (
          <div className="absolute top-3 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
            <span className="text-white text-sm font-medium">
              {creditsRemaining > 0 ? (
                <><span className="text-green-400">●</span> {creditsRemaining} credits</>
              ) : (
                <><span className="text-red-400">●</span> No credits</>
              )}
            </span>
          </div>
        )}
        <div className="absolute top-3 right-4 text-white font-semibold text-xl flex items-center bg-black/40 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/10">
          <span className={`w-2 h-2 rounded-full mr-2 ${state === "recording" ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
          <span ref={timerRef}>{isUploading ? "Uploading..." : timer}</span>
        </div>

        {/* View Mode Toggle */}
        <div className="absolute top-16 right-4 flex flex-col gap-2 z-50">
          <button
            onClick={() => setViewMode(viewMode === 'teleprompter' ? 'resume' : 'teleprompter')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border shadow-lg ${viewMode === 'resume'
              ? 'bg-blue-600 border-blue-400 text-white'
              : 'bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-md'
              }`}
          >
            {viewMode === 'teleprompter' ? <FileText className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            {viewMode === 'teleprompter' ? 'Show Resume' : 'Show Script'}
          </button>
        </div>

        <div className="absolute bottom-[8rem] left-1/2 transform -translate-x-1/2 w-[100%] max-h-[40%] overflow-hidden">
          <div
            ref={teleprompterRef}
            className={`w-full text-white font-sans text-xl md:text-2xl leading-relaxed font-medium text-center bg-gradient-to-b from-black/80 to-black/40 px-6 py-8 rounded-lg pointer-events-none transition-all duration-500 ${viewMode === 'resume' ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
              }`}
          >
            <div className="flex flex-col gap-6 pb-10">
              {teleprompterText.split(/\n\s*\n/).map((para, i) => (
                <p key={i} className="whitespace-pre-line">{para}</p>
              ))}
            </div>
          </div>

          {/* Resume Content View - Improved with PDF Iframe */}
          {viewMode === 'resume' && (
            <div className="absolute inset-0 bg-white text-black p-0 overflow-hidden animate-in fade-in zoom-in-95 duration-300 pointer-events-auto rounded-t-2xl shadow-2xl flex flex-col">
              <div className="bg-slate-900 text-white p-3 flex justify-between items-center shrink-0">
                <h4 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  Resume Content Reference
                </h4>
                <button
                  onClick={() => setViewMode('teleprompter')}
                  className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[10px] uppercase font-bold"
                >
                  Switch to Script
                </button>
              </div>
              <div className="flex-1 w-full bg-gray-100 relative">
                {resumeUrl ? (
                  <iframe
                    src={`${resumeUrl}#toolbar=0&navpanes=0&view=FitH`}
                    className="w-full h-full border-0"
                    title="Resume Preview"
                  />
                ) : (
                  <div className="p-6 text-sm text-gray-500 text-center flex flex-col items-center justify-center h-full">
                    <p className="mb-2">No resume PDF available.</p>
                    <div className="text-[11px] bg-gray-50 p-3 rounded border whitespace-pre-wrap text-left max-h-[80%] overflow-y-auto">
                      {resumeFullText || "No resume text found."}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-4 left-0 right-0 pointer-events-none flex justify-center">
                  <div className="bg-black/80 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-sm border border-white/20">
                    Scroll inside to view full resume
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleRecordClick}
          disabled={recordingDisabled}
          className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full border-4 border-white/85 cursor-pointer transition-all duration-200 flex items-center justify-center ${recordingDisabled ? "opacity-40 cursor-not-allowed" : state === "recording" ? "bg-red-500 shadow-[0_0_0_6px_rgba(255,59,48,0.35),0_0_24px_rgba(255,59,48,0.8)]" : "bg-red-500 hover:scale-105 active:scale-95"
            }`}
        >
          <div className={`w-8 h-8 rounded-full ${state === "recording" ? "bg-red-700" : "bg-red-400"}`} />
        </button>
      </div>
    </div>
  );
};

export default Record;
