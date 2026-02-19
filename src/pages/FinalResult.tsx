import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Download, Play, ArrowLeft, LogOut, MessageSquare, Link, Copy, CheckCircle } from "lucide-react";
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
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'chat' | 'video' | 'resume'>('chat');

  // ✅ Handle URL query parameters for mode
  useEffect(() => {
    // Set window name to help with targeting from external sources
    window.name = "careercast_main";

    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const fromPdf = params.get('from') === 'pdf';

    // Only auto-open if explicitly coming from PDF version
    if (fromPdf && (mode === 'video' || mode === 'chat' || mode === 'resume')) {
      setPanelMode(mode as 'chat' | 'video' | 'resume');
      setIsPanelOpen(true);
    }
  }, [location.search]);

  // ✅ Load data from localStorage or Supabase
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        console.log("Loading data with:", { user, castId });
        // Check if this is an external visitor (no user but has castId)
        const isExternal = !user && castId;
        setIsExternalVisitor(!!isExternal);

        if (castId) {
          // If we have a specific castId (from URL), load that specific record
          await loadExternalData(castId);
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
    const jobTitle = localStorage.getItem("careercast_jobTitle");
    const currentJobRequestId = localStorage.getItem("current_job_request_id");
    const isCRMUser = localStorage.getItem("is_crm_user") === "true";
    const crmEmail = localStorage.getItem("crm_user_email");

    console.log("Loading local data with:", {
      uploadedResumeUrl,
      recordedVideoUrl,
      currentJobRequestId,
      isCRMUser,
      crmEmail
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
            setJobTitle(data.job_title || jobTitle || "");
            setResumeUrl(data.resume_url || uploadedResumeUrl);
            setResumeFileName(fileName || data.resume_url ?
              data.resume_url.split('/').pop() || "Resume.pdf" :
              "Resume.pdf");

            // Get video URL from crm_recordings
            const { data: recordingData } = await supabase
              .from('crm_recordings')
              .select('video_url')
              .eq('job_request_id', currentJobRequestId)
              .limit(1)
              .single();

            let finalVideoUrl = null;
            if (recordingData?.video_url) {
              const path = recordingData.video_url;
              // Convert relative storage path to public URL if needed
              finalVideoUrl = path.startsWith('http')
                ? path
                : supabase.storage.from('CRM_users_recordings').getPublicUrl(path).data.publicUrl;
            } else {
              finalVideoUrl = recordedVideoUrl || null;
            }

            setVideoUrl(finalVideoUrl);

            console.log("Set CRM state values:", {
              jobTitle: data.job_title || jobTitle || "",
              resumeUrl: data.resume_url || uploadedResumeUrl,
              resumeFileName,
              videoUrl: finalVideoUrl
            });

            // Fetch owner's name for filename
            if (data.user_id) {
              const { data: profile } = await supabase.from('profiles').select('first_name, last_name, full_name').eq('id', data.user_id).single();
              if (profile) setCandidateName(profile.first_name || profile.full_name?.split(' ')[0] || "Candidate");
            }

            return;
          } else {
            console.error("CRM Supabase error or no data:", error);
          }
        } else {
          // Regular User - Query job_requests table
          const { data, error } = await supabase
            .from('job_requests')
            .select(`
              job_title,
              resume_path,
              resume_original_name,
              user_id,
              recordings (
                storage_path
              )
            `)
            .eq('id', currentJobRequestId)
            .single();

          console.log("Regular Supabase data:", { data, error });

          if (!error && data) {
            setJobTitle(data.job_title || jobTitle || "");
            setResumeUrl(data.resume_path || uploadedResumeUrl);
            setResumeFileName(fileName || data.resume_original_name || (data.resume_path ?
              data.resume_path.split('/').pop() || "Resume.pdf" :
              "Resume.pdf"));

            // Get video URL from recordings
            let finalVideoUrl = null;
            if (data.recordings && data.recordings.length > 0) {
              const path = data.recordings[0].storage_path;
              // ✅ Convert relative storage path to public URL if needed
              if (path) {
                finalVideoUrl = path.startsWith('http')
                  ? path
                  : supabase.storage.from('recordings').getPublicUrl(path).data.publicUrl;
              } else {
                finalVideoUrl = recordedVideoUrl || null;
              }
            } else {
              finalVideoUrl = recordedVideoUrl || null;
            }

            setVideoUrl(finalVideoUrl);

            console.log("Set state values:", {
              jobTitle: data.job_title || jobTitle || "",
              resumeUrl: data.resume_path || uploadedResumeUrl,
              resumeFileName: fileName || (data.resume_path ?
                data.resume_path.split('/').pop() || "Resume.pdf" :
                "Resume.pdf"),
              videoUrl: finalVideoUrl
            });

            // Fetch owner's name for filename
            if (data.user_id) {
              const { data: profile } = await supabase.from('profiles').select('first_name, last_name, full_name').eq('id', data.user_id).single();
              if (profile) setCandidateName(profile.first_name || profile.full_name?.split(' ')[0] || "Candidate");
            }

            return;
          } else {
            console.error("Supabase error or no data:", error);
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
      // Ensure the video URL is properly formatted
      if (finalVideoUrl && !finalVideoUrl.startsWith('http')) {
        // If it's a relative path, construct the full URL
        try {
          const bucket = isCRMUser ? 'CRM_users_recordings' : 'recordings';
          finalVideoUrl = supabase.storage.from(bucket).getPublicUrl(finalVideoUrl).data.publicUrl;
        } catch (urlError) {
          console.error("Error constructing video URL:", urlError);
          // Fallback to the original URL
        }
      }
      setVideoUrl(finalVideoUrl);
    }
    if (jobTitle) setJobTitle(jobTitle);
  };

  const loadExternalData = async (id: string) => {
    try {
      // Try CRM tables first
      const { data: crmData, error: crmError } = await supabase
        .from('crm_job_requests')
        .select(`
          job_title,
          resume_url,
          application_status,
          user_id
        `)
        .eq('id', id)
        .maybeSingle();

      if (crmData) {
        setJobTitle(crmData.job_title || "");
        setResumeUrl(crmData.resume_url || null);
        setResumeFileName(crmData.resume_url ?
          crmData.resume_url.split('/').pop() || "Resume.pdf" :
          "Resume.pdf");

        const { data: recordingData } = await supabase
          .from('crm_recordings')
          .select('video_url')
          .eq('job_request_id', id)
          .maybeSingle();

        let finalVideoUrl = null;
        if (recordingData?.video_url) {
          const path = recordingData.video_url;
          finalVideoUrl = path.startsWith('http')
            ? path
            : supabase.storage.from('CRM_users_recordings').getPublicUrl(path).data.publicUrl;
        }
        setVideoUrl(finalVideoUrl);
        // Fetch candidate name
        if (crmData.user_id) {
          const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', crmData.user_id).single();
          if (profile) setCandidateName(profile.first_name || "Candidate");
        }
        return;
      }

      const { data, error } = await supabase
        .from('job_requests')
        .select(`
          job_title,
          resume_path,
          resume_original_name,
          user_id,
          recordings (
            storage_path
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (data) {
        setJobTitle(data.job_title || "");
        setResumeUrl(data.resume_path || null);
        setResumeFileName(data.resume_original_name || (data.resume_path ?
          data.resume_path.split('/').pop() || "Resume.pdf" :
          "Resume.pdf"));

        let finalVideoUrl = null;
        if (data.recordings && data.recordings.length > 0) {
          const path = data.recordings[0].storage_path;
          if (path) {
            finalVideoUrl = path.startsWith('http')
              ? path
              : supabase.storage.from('recordings').getPublicUrl(path).data.publicUrl;
          }
        }
        setVideoUrl(finalVideoUrl);

        // Fetch candidate name
        if (data.user_id) {
          const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', data.user_id).single();
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

  // ✅ Enhance PDF
  const enhancePDF = async (resumeUrl: string, castId: string) => {
    try {
      const baseUrl = window.location.origin || "https://careercast-omega.vercel.app";
      const finalResultUrl = `${baseUrl}/final-result/${castId || "profile"}`;
      const hasVideo = !!videoUrl;

      let response = await fetch(resumeUrl);
      if (!response.ok) response = await fetch(resumeUrl, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch PDF");

      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const lastPage = pages[pages.length - 1];
      const { width, height } = firstPage.getSize();
      const lastPageSize = lastPage.getSize();

      const btnW_play = 110;
      const btnW_chat = 125;
      const btnH = 32;
      const gap = 12;
      const margin = 20;

      const totalW = hasVideo ? (btnW_play + gap + btnW_chat) : btnW_chat;
      let currentX = width - totalW - margin;
      const btnY = height - btnH - margin;

      const white = rgb(1, 1, 1);
      const context = pdfDoc.context;

      // 1. Render Chat with Resume (Top Right of First Page)
      const chatButtonUrl = `${baseUrl}/images/chat_with_resume_button.png`;
      let chatRes;
      try {
        chatRes = await fetch(chatButtonUrl);
      } catch (err) {
        chatRes = await fetch(chatButtonUrl, { credentials: 'include' });
      }

      if (chatRes.ok) {
        const chatBytes = await chatRes.arrayBuffer();
        const chatImg = await pdfDoc.embedPng(chatBytes);

        firstPage.drawImage(chatImg, {
          x: currentX,
          y: btnY,
          width: btnW_chat,
          height: btnH
        });

        const chatLink = context.obj({
          Type: PDFName.of("Annot"), Subtype: PDFName.of("Link"),
          Rect: context.obj([PDFNumber.of(currentX), PDFNumber.of(btnY), PDFNumber.of(currentX + btnW_chat), PDFNumber.of(btnY + btnH)]),
          Border: context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]),
          A: context.obj({ S: PDFName.of("URI"), URI: PDFString.of(`${finalResultUrl}?mode=chat&from=pdf`) })
        });

        let annotsChat = firstPage.node.lookup(PDFName.of("Annots"));
        if (annotsChat instanceof PDFArray) annotsChat.push(chatLink);
        else firstPage.node.set(PDFName.of("Annots"), context.obj([chatLink]));

        currentX += btnW_chat + gap;
      }

      // 2. Render Play Intro (Top Right of First Page)
      if (hasVideo) {
        const playButtonUrl = `${baseUrl}/images/play_intro.png`;
        let playRes;
        try {
          playRes = await fetch(playButtonUrl);
        } catch (err) {
          playRes = await fetch(playButtonUrl, { credentials: 'include' });
        }

        if (playRes.ok) {
          const playBytes = await playRes.arrayBuffer();
          const playImg = await pdfDoc.embedPng(playBytes);

          firstPage.drawImage(playImg, {
            x: currentX,
            y: btnY,
            width: btnW_play,
            height: btnH
          });

          const playLink = context.obj({
            Type: PDFName.of("Annot"), Subtype: PDFName.of("Link"),
            Rect: context.obj([PDFNumber.of(currentX), PDFNumber.of(btnY), PDFNumber.of(currentX + btnW_play), PDFNumber.of(btnY + btnH)]),
            Border: context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]),
            A: context.obj({ S: PDFName.of("URI"), URI: PDFString.of(`${finalResultUrl}?mode=video&from=pdf`) })
          });

          let annots = firstPage.node.lookup(PDFName.of("Annots"));
          if (annots instanceof PDFArray) annots.push(playLink);
          else firstPage.node.set(PDFName.of("Annots"), context.obj([playLink]));
        }
      }

      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: "application/pdf" });
      return URL.createObjectURL(blob);
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

      // Prepare dynamic filename based on candidate's name
      const userName = candidateName !== "Candidate" ? candidateName : (user?.firstName || user?.name || localStorage.getItem("first_name") || "Candidate");
      const finalFileName = `${userName}_DIGITALRESUME.pdf`;

      const a = document.createElement("a");
      a.href = enhancedUrl;
      a.download = finalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(enhancedUrl), 1000);
    } catch (err) {
      showToast("Download failed", "error");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b shadow-sm z-[100]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center px-4 py-3 gap-4">
          {user && !isFromPdf ? (
            <Button
              variant="outline"
              onClick={() => {
                const isCRM = localStorage.getItem('is_crm_user') === 'true';
                navigate(isCRM ? "/digitalresumedashboard" : "/dashboard");
              }}
              className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          ) : (
            <div></div> // Minimal spacer
          )}

          {!isFromPdf && user && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={handleDownloadEnhanced}
                className="flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 h-10 px-4"
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
                  let shareableLink = window.location.href.split('?')[0];

                  if (!castId && currentCastId) {
                    shareableLink = `${window.location.origin}/final-result/${currentCastId}`;
                  }

                  if (!shareableLink.includes('/final-result/')) {
                    showToast('Unable to generate valid shareable link.', 'error');
                    return;
                  }

                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(shareableLink).then(() => {
                      showToast('Digital Resume link copied to clipboard!', 'success');
                    }).catch(err => {
                      console.error('Failed to copy: ', err);
                      showToast('Failed to copy link.', 'error');
                    });
                  } else {
                    // Fallback
                    const textArea = document.createElement("textarea");
                    textArea.value = shareableLink;
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                      document.execCommand('copy');
                      showToast('Digital Resume link copied to clipboard!', 'success');
                    } catch (err) {
                      showToast('Failed to copy link.', 'error');
                    }
                    document.body.removeChild(textArea);
                  }
                }}
                className="flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 h-10 px-4"
              >
                <Link className="h-4 w-4" />
                <span className="hidden sm:inline">Copy Digital Resume Link</span>
                <span className="sm:hidden">Copy Link</span>
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {videoUrl && (
              <button
                onClick={() => {
                  setPanelMode('video');
                  setIsPanelOpen(true);
                  const newParams = new URLSearchParams(location.search);
                  newParams.set('mode', 'video');
                  navigate({ search: newParams.toString() });
                }}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 shadow-md hover:scale-105 ${isPanelOpen && panelMode === 'video'
                  ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 scale-[1.05] z-10"
                  : "bg-blue-600 text-white"
                  }`}
              >
                <Play className="h-4 w-4" />
                Play Intro
              </button>
            )}
            <button
              onClick={() => {
                setPanelMode('chat');
                setIsPanelOpen(true);
                const newParams = new URLSearchParams(location.search);
                newParams.set('mode', 'chat');
                navigate({ search: newParams.toString() });
              }}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 shadow-md hover:scale-105 ${isPanelOpen && panelMode === 'chat'
                ? "bg-[#159A9C] text-white ring-2 ring-teal-400 ring-offset-2 scale-[1.05] z-10"
                : "bg-[#159A9C] text-white"
                }`}
            >
              <MessageSquare className="h-4 w-4" />
              Chat with Resume
            </button>
          </div>

          {user && !isFromPdf && (
            <Button
              variant="outline"
              onClick={handleLogout}
              className="hidden md:flex border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          )}
        </div>
      </header>

      <div className="relative pt-32 pb-10 min-h-screen bg-slate-50/50">
        <div className="w-full max-w-7xl mx-auto px-4 pt-5">
          {resumeUrl ? (
            <div className="w-full bg-white shadow-2xl rounded-xl border border-slate-200 overflow-hidden">
              <iframe src={`${resumeUrl}#zoom=100&view=FitH`} title="Resume Preview" className="w-full border-0 min-h-[1100px]" style={{ display: 'block', width: '100%', height: 'auto' }} allowFullScreen />
            </div>
          ) : <div className="min-h-[400px] flex items-center justify-center text-gray-500">No resume available.</div>}
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
        />
      )}
    </div>
  );
};

export default FinalResult;
