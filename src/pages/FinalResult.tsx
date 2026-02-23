import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Download, Play, ArrowLeft, LogOut, MessageSquare, Link, Copy, CheckCircle, Loader2 } from "lucide-react";
import { useAuthContext } from "../contexts/AuthContext";
import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFString, rgb } from "pdf-lib";
import { supabase } from "../integrations/supabase/client";
import { showToast } from "../components/ui/toast";
import ResumeChatPanel from "../components/ResumeChatPanel";

const FinalResult: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthContext();
  const { castId } = useParams<{ castId: string }>();

  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string>("Resume.pdf");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState<string>("");
  const [isExternalVisitor, setIsExternalVisitor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [candidateName, setCandidateName] = useState<string>("Candidate");

  const searchParams = new URLSearchParams(location.search);
  const isFromPdf = searchParams.get('from') === 'pdf';

  // Panel State
  const initialParams = new URLSearchParams(window.location.search);
  const initialMode = initialParams.get('mode') as 'chat' | 'video' | 'resume' | null;
  const initialFromPdf = initialParams.get('from') === 'pdf';

  const [isPanelOpen, setIsPanelOpen] = useState(initialFromPdf && !!initialMode);
  const [panelMode, setPanelMode] = useState<'chat' | 'video' | 'resume'>(initialMode || 'chat');

  // ✅ Handle URL query parameters for mode
  useEffect(() => {
    // Set window name to help with targeting from external sources
    window.name = "careercast_main";

    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const fromPdf = params.get('from') === 'pdf';

    // Update panel state if URL changes after mount
    if (fromPdf && (mode === 'video' || mode === 'chat' || mode === 'resume')) {
      if (!isPanelOpen || panelMode !== mode) {
        setPanelMode(mode as 'chat' | 'video' | 'resume');
        setIsPanelOpen(true);
      }
    }
  }, [location.search, isPanelOpen, panelMode]);

  // ✅ Load data from localStorage or Supabase
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const idFromQuery = new URLSearchParams(location.search).get('id');
        const effectiveId = castId || idFromQuery;

        console.log("Loading data with:", { user, castId, idFromQuery });
        // Check if this is an external visitor (no user but has an ID)
        const isExternal = !user && effectiveId;
        setIsExternalVisitor(!!isExternal);

        if (effectiveId) {
          // If we have an ID (from path or query), load that specific record
          await loadExternalData(effectiveId);
        } else {
          // Otherwise load from localStorage (fallback for legacy or incomplete flows)
          await loadLocalData();
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, castId]);

  const loadLocalData = async () => {
    // First try to get data from localStorage
    const uploadedResumeUrl = localStorage.getItem("uploadedResumeUrl");
    const fileName = localStorage.getItem("resumeFileName");
    const recordedVideoUrl = localStorage.getItem("recordedVideoUrl");
    const jobTitleValue = localStorage.getItem("careercast_jobTitle");
    const currentJobRequestId = localStorage.getItem("current_job_request_id");
    const isCRMUser = localStorage.getItem("is_crm_user") === "true";

    console.log("Loading local data with:", {
      uploadedResumeUrl,
      recordedVideoUrl,
      currentJobRequestId,
      isCRMUser
    });

    // If we have a job request ID, fetch the latest data from Supabase
    if (currentJobRequestId) {
      try {
        if (isCRMUser) {
          // CRM User - Query crm_job_requests table
          const { data, error } = await supabase
            .from('crm_job_requests')
            .select(`
              job_title,
              resume_url,
              application_status,
              user_id
            `)
            .eq('id', currentJobRequestId)
            .single();

          console.log("CRM Supabase data:", { data, error });

          if (!error && data) {
            setJobTitle(data.job_title || jobTitleValue || "");
            setResumeUrl(data.resume_url || uploadedResumeUrl);
            setResumeFileName(fileName || (data.resume_url ?
              data.resume_url.split('/').pop() || "Resume.pdf" :
              "Resume.pdf"));

            // Get latest video URL from crm_recordings
            const { data: recordings } = await supabase
              .from('crm_recordings')
              .select('video_url')
              .eq('job_request_id', currentJobRequestId)
              .order('created_at', { ascending: false })
              .limit(1);

            let finalVideoUrl = null;
            if (recordings && recordings.length > 0 && recordings[0].video_url) {
              const path = recordings[0].video_url;
              finalVideoUrl = path.startsWith('http')
                ? path
                : supabase.storage.from('CRM_users_recordings').getPublicUrl(path).data.publicUrl;
            } else {
              finalVideoUrl = recordedVideoUrl || null;
            }

            setVideoUrl(finalVideoUrl);

            // Fetch owner's name for filename
            if (data.user_id) {
              const { data: profile } = await supabase.from('profiles').select('first_name, last_name, full_name').eq('id', data.user_id).single();
              if (profile) setCandidateName(profile.first_name || profile.full_name?.split(' ')[0] || "Candidate");
            }

            return;
          }
        } else {
          // Regular User - Query job_requests table
          const { data, error } = await supabase
            .from('job_requests')
            .select(`
              job_title,
              resume_path,
              resume_original_name,
              user_id
            `)
            .eq('id', currentJobRequestId)
            .single();

          if (!error && data) {
            setJobTitle(data.job_title || jobTitleValue || "");
            setResumeUrl(data.resume_path || uploadedResumeUrl);
            setResumeFileName(fileName || data.resume_original_name || (data.resume_path ?
              data.resume_path.split('/').pop() || "Resume.pdf" :
              "Resume.pdf"));

            // Get latest video URL from recordings
            const { data: recs } = await supabase
              .from('recordings')
              .select('storage_path')
              .eq('job_request_id', currentJobRequestId)
              .order('created_at', { ascending: false })
              .limit(1);

            let finalVideoUrl = null;
            if (recs && recs.length > 0 && recs[0].storage_path) {
              const path = recs[0].storage_path;
              finalVideoUrl = path.startsWith('http')
                ? path
                : supabase.storage.from('recordings').getPublicUrl(path).data.publicUrl;
            } else {
              finalVideoUrl = recordedVideoUrl || null;
            }

            setVideoUrl(finalVideoUrl);

            // Fetch owner's name for filename
            if (data.user_id) {
              const { data: profile } = await supabase.from('profiles').select('first_name, last_name, full_name').eq('id', data.user_id).single();
              if (profile) setCandidateName(profile.first_name || profile.full_name?.split(' ')[0] || "Candidate");
            }

            return;
          }
        }
      } catch (error) {
        console.error("Error fetching from Supabase:", error);
      }
    }

    // Fallback to localStorage data
    if (uploadedResumeUrl) setResumeUrl(uploadedResumeUrl);
    if (fileName) setResumeFileName(fileName);
    else setResumeFileName("Resume.pdf");
    if (recordedVideoUrl) {
      let finalVideoUrl = recordedVideoUrl;
      if (finalVideoUrl && !finalVideoUrl.startsWith('http')) {
        try {
          const bucket = isCRMUser ? 'CRM_users_recordings' : 'recordings';
          finalVideoUrl = supabase.storage.from(bucket).getPublicUrl(finalVideoUrl).data.publicUrl;
        } catch (urlError) {
          console.error("Error constructing video URL:", urlError);
        }
      }
      setVideoUrl(finalVideoUrl);
    }
    if (jobTitleValue) setJobTitle(jobTitleValue);
  };

  const loadExternalData = async (id: string) => {
    try {
      // Parallelize checking CRM and regular tables
      const [crmResult, regularResult] = await Promise.all([
        supabase.from('crm_job_requests').select('job_title, resume_url, application_status, user_id').eq('id', id).maybeSingle(),
        supabase.from('job_requests').select('job_title, resume_path, resume_original_name, user_id').eq('id', id).maybeSingle()
      ]);

      if (crmResult.data) {
        const crmData = crmResult.data;
        setJobTitle(crmData.job_title || "");
        setResumeUrl(crmData.resume_url || null);
        setResumeFileName(crmData.resume_url ?
          crmData.resume_url.split('/').pop() || "Resume.pdf" :
          "Resume.pdf");

        const { data: recordings } = await supabase
          .from('crm_recordings')
          .select('video_url')
          .eq('job_request_id', id)
          .order('created_at', { ascending: false })
          .limit(1);

        let finalVideoUrl = null;
        if (recordings && recordings.length > 0 && recordings[0].video_url) {
          const path = recordings[0].video_url;
          finalVideoUrl = path.startsWith('http')
            ? path
            : supabase.storage.from('CRM_users_recordings').getPublicUrl(path).data.publicUrl;
        } else {
          finalVideoUrl = localStorage.getItem("recordedVideoUrl");
        }
        setVideoUrl(finalVideoUrl);

        if (crmData.user_id) {
          const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', crmData.user_id).maybeSingle();
          if (profile) setCandidateName(profile.first_name || "Candidate");
        }
        return;
      }

      if (regularResult.data) {
        const data = regularResult.data;
        setJobTitle(data.job_title || "");
        setResumeUrl(data.resume_path || null);
        setResumeFileName(data.resume_original_name || (data.resume_path ?
          data.resume_path.split('/').pop() || "Resume.pdf" :
          "Resume.pdf"));

        const { data: recordings } = await supabase
          .from('recordings')
          .select('storage_path')
          .eq('job_request_id', id)
          .order('created_at', { ascending: false })
          .limit(1);

        let finalVideoUrl = null;
        if (recordings && recordings.length > 0 && recordings[0].storage_path) {
          const path = recordings[0].storage_path;
          finalVideoUrl = path.startsWith('http')
            ? path
            : supabase.storage.from('recordings').getPublicUrl(path).data.publicUrl;
        } else {
          finalVideoUrl = localStorage.getItem("recordedVideoUrl");
        }
        setVideoUrl(finalVideoUrl);

        if (data.user_id) {
          const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', data.user_id).maybeSingle();
          if (profile) setCandidateName(profile.first_name || "Candidate");
        }
      }
    } catch (error) {
      console.error("❌ Error loading external data:", error);
    }
  };

  const closePanel = () => setIsPanelOpen(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const enhancePDF = async (resumeUrlStr: string, currentRequestId: string) => {
    try {
      const chatUrl = `${window.location.origin}/chat?resumeId=${currentRequestId}`;
      const playIntroUrl = `${window.location.origin}/final-result/${currentRequestId}?from=pdf&mode=video`;
      const hasVideo = !!videoUrl;

      let response = await fetch(resumeUrlStr);
      if (!response.ok) response = await fetch(resumeUrlStr, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch PDF");

      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      const btnW_play = 110;
      const btnW_chat = 125;
      const btnH = 32;
      const gap = 12;
      const margin = 20;

      const totalW = hasVideo ? (btnW_play + gap + btnW_chat) : btnW_chat;
      let currentX = width - totalW - margin;
      const btnY = height - btnH - margin;

      const context = pdfDoc.context;

      const chatButtonRes = await fetch(`${window.location.origin}/images/chat_with_resume_button.png`);
      if (chatButtonRes.ok) {
        const chatBytes = await chatButtonRes.arrayBuffer();
        const chatImg = await pdfDoc.embedPng(chatBytes);
        firstPage.drawImage(chatImg, { x: currentX, y: btnY, width: btnW_chat, height: btnH });
        const chatLink = context.obj({
          Type: PDFName.of("Annot"), Subtype: PDFName.of("Link"),
          Rect: context.obj([PDFNumber.of(currentX), PDFNumber.of(btnY), PDFNumber.of(currentX + btnW_chat), PDFNumber.of(btnY + btnH)]),
          Border: context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]),
          A: context.obj({ S: PDFName.of("URI"), URI: PDFString.of(chatUrl) })
        });
        let annots = firstPage.node.lookup(PDFName.of("Annots"));
        if (annots instanceof PDFArray) annots.push(chatLink);
        else firstPage.node.set(PDFName.of("Annots"), context.obj([chatLink]));
        currentX += btnW_chat + gap;
      }

      if (hasVideo) {
        const playButtonRes = await fetch(`${window.location.origin}/images/play_intro.png`);
        if (playButtonRes.ok) {
          const playBytes = await playButtonRes.arrayBuffer();
          const playImg = await pdfDoc.embedPng(playBytes);
          firstPage.drawImage(playImg, { x: currentX, y: btnY, width: btnW_play, height: btnH });
          const playLink = context.obj({
            Type: PDFName.of("Annot"), Subtype: PDFName.of("Link"),
            Rect: context.obj([PDFNumber.of(currentX), PDFNumber.of(btnY), PDFNumber.of(currentX + btnW_play), PDFNumber.of(btnY + btnH)]),
            Border: context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]),
            A: context.obj({ S: PDFName.of("URI"), URI: PDFString.of(playIntroUrl) })
          });
          let annots = firstPage.node.lookup(PDFName.of("Annots"));
          if (annots instanceof PDFArray) annots.push(playLink);
          else firstPage.node.set(PDFName.of("Annots"), context.obj([playLink]));
        }
      }

      const modifiedPdfBytes = await pdfDoc.save();
      return URL.createObjectURL(new Blob([new Uint8Array(modifiedPdfBytes)], { type: "application/pdf" }));
    } catch (error) {
      console.error("Error enhancing PDF:", error);
      throw error;
    }
  };

  const handleDownloadEnhanced = async () => {
    try {
      if (!resumeUrl) return;
      const currentCastId = castId || localStorage.getItem("current_job_request_id") || "profile";
      const enhancedUrl = await enhancePDF(resumeUrl, currentCastId);
      const userName = candidateName !== "Candidate" ? candidateName : (user?.firstName || user?.name || "Candidate");
      const a = document.createElement("a");
      a.href = enhancedUrl;
      a.download = `${userName}_DIGITALRESUME.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(enhancedUrl), 1000);
    } catch (err) {
      showToast("Download failed", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b shadow-sm z-[100]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center px-4 py-3 gap-4">
          {user && !isFromPdf ? (
            <Button
              variant="outline"
              onClick={() => {
                const isAdmin = sessionStorage.getItem('digital_resume_admin_access') === 'true';
                navigate(isAdmin ? "/digital-resume-dashboard" : "/dashboard");
              }}
              className="flex items-center gap-2 border-gray-300 text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          ) : <div />}

          {!isFromPdf && user && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={handleDownloadEnhanced}
                className="flex items-center gap-2 border-blue-500 text-blue-600 h-10 px-4"
                disabled={!resumeUrl}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download Enhanced Resume</span>
                <span className="sm:hidden">Download</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  const currentCastId = castId || localStorage.getItem("current_job_request_id");
                  const shareableLink = `${window.location.origin}/final-result/${currentCastId || ""}`;
                  navigator.clipboard.writeText(shareableLink).then(() => showToast('Link copied!', 'success'));
                }}
                className="flex items-center gap-2 border-green-500 text-green-600 h-10 px-4"
              >
                <Link className="h-4 w-4" />
                <span className="hidden sm:inline">Copy Link</span>
                <span className="sm:hidden">Link</span>
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {videoUrl && (
              <button
                onClick={() => { setPanelMode('video'); setIsPanelOpen(true); }}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-md hover:scale-105 transition-all"
              >
                <Play className="h-4 w-4" />
                Play Intro
              </button>
            )}
            <button
              onClick={() => {
                const currentCastId = castId || localStorage.getItem("current_job_request_id") || "123";
                window.open(`${window.location.origin}/chat?resumeId=${currentCastId}`, '_blank');
              }}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[#159A9C] text-white shadow-md hover:scale-105 transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              Chat with Resume
            </button>
          </div>

          {user && !isFromPdf && (
            <Button variant="outline" onClick={handleLogout} className="hidden md:flex">
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          )}
        </div>
      </header>

      <div className="relative pt-32 pb-10 min-h-screen scrollbar-hide">
        <div className="w-full max-w-7xl mx-auto px-4 pt-5">
          {resumeUrl ? (
            <div className="w-full bg-white shadow-2xl rounded-xl border border-slate-200 overflow-hidden">
              <iframe src={`${resumeUrl}#zoom=100&view=FitH`} title="Resume Preview" className="w-full border-0 min-h-[1100px]" style={{ display: 'block', width: '100%' }} allowFullScreen />
            </div>
          ) : loading ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="min-h-[400px] flex items-center justify-center text-gray-500">No resume available.</div>
          )}
        </div>
      </div>

      {isPanelOpen && (
        <ResumeChatPanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          mode={panelMode}
          videoUrl={videoUrl}
          resumeUrl={resumeUrl}
          onModeChange={setPanelMode}
          onDownload={handleDownloadEnhanced}
          isParentLoading={loading}
        />
      )}
    </div>
  );
};

export default FinalResult;
