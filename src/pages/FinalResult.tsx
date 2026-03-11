import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Download, Play, ArrowLeft, LogOut, MessageSquare, Link, Copy, CheckCircle, Loader2, X, AlertCircle, Link2, Pencil } from "lucide-react";
import { useAuthContext } from "../contexts/AuthContext";
import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFString, rgb } from "pdf-lib";
import { supabase } from "../integrations/supabase/client";
import { showToast } from "../components/ui/toast";
import ResumeChatPanel from "../components/ResumeChatPanel";
import type { ResumeChatPanelProps } from "../components/ResumeChatPanel";
import { trackEvent, trackSessionEnd } from "../utils/tracking";

const generateButtonImage = async (text: string, iconSrc: string, width: number, height: number, iconWidth: number, iconHeight: number): Promise<string | null> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const dpr = 4;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(null); return; }
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0A66C2';
    const radius = 6;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.quadraticCurveTo(width, 0, width, radius);
    ctx.lineTo(width, height - radius);
    ctx.quadraticCurveTo(width, height, width - radius, height);
    ctx.lineTo(radius, height);
    ctx.quadraticCurveTo(0, height, 0, height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = '#CEDFF9';
    ctx.lineWidth = 2;
    ctx.stroke();

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.font = 'bold 12px Arial';
      const textMetrics = ctx.measureText(text);
      const gap = 6;
      const totalContentW = iconWidth + gap + textMetrics.width;
      const startX = (width - totalContentW) / 2;

      ctx.drawImage(img, startX, (height - iconHeight) / 2, iconWidth, iconHeight);

      ctx.fillStyle = 'white';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, startX + iconWidth + gap, height / 2 + 1);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = iconSrc;
  });
};

const getProxiedUrl = (url: string | null) => {
  if (!url) return "";
  // If it's already a relative path (our proxy), return as is
  if (url.startsWith('/proxy-') || url.startsWith('/api/proxy-pdf')) return url;

  // Use our dynamic proxy for any S3 or Vercel Blob URLs to bypass CORS
  if (url.includes('amazonaws.com') || url.includes('vercel-storage.com')) {
    return `/api/proxy-pdf?url=${encodeURIComponent(url)}`;
  }

  return url;
};

const FinalResult: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuthContext();
  const { castId } = useParams<{ castId: string }>();

  const searchParams = new URLSearchParams(location.search);
  const idFromQuery = searchParams.get('id') || searchParams.get('resumeId');
  const urlFromQuery = searchParams.get('resumeUrl');
  const emailParam = searchParams.get('email');

  const [resumeUrl, setResumeUrl] = useState<string | null>(
    urlFromQuery ? decodeURIComponent(urlFromQuery) : null
  );
  const [resumeFileName, setResumeFileName] = useState<string>(
    urlFromQuery ? (decodeURIComponent(urlFromQuery).split('/').pop()?.split('?')[0] || "Resume.pdf") : "Resume.pdf"
  );
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState<string>("");
  const [loading, setLoading] = useState(!urlFromQuery && !!(castId || idFromQuery));
  const [candidateName, setCandidateName] = useState<string>("Candidate");

  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [isEditingPortfolio, setIsEditingPortfolio] = useState(false);
  const [tempPortfolioUrl, setTempPortfolioUrl] = useState("");
  const [resumeOwnerEmail, setResumeOwnerEmail] = useState<string | null>(
    emailParam ? decodeURIComponent(emailParam) : null
  );
  const [resumeOwnerAppEmail, setResumeOwnerAppEmail] = useState<string | null>(null);
  const [resumeOwnerUserId, setResumeOwnerUserId] = useState<string | null>(null);

  const isFromPdf = searchParams.get('from') === 'pdf' || searchParams.get('source') === 'pdf';
  const initialId = castId || idFromQuery;
  const [isSyncingWithVercel, setIsSyncingWithVercel] = useState(initialId === 'profile' || !!emailParam);

  // Determine external visitor status immediately if possible
  const [isExternalVisitor, setIsExternalVisitor] = useState(!!(!user && initialId));

  // Panel State
  const initialMode = searchParams.get('mode') as 'chat' | 'video' | 'resume' | null;
  const [isPanelOpen, setIsPanelOpen] = useState(isFromPdf && !!initialMode);
  const [panelMode, setPanelMode] = useState<'chat' | 'video' | 'resume'>(initialMode || 'chat');

  // ✅ Tracking Implementation
  useEffect(() => {
    const currentCastId = castId || searchParams.get('id');
    if (currentCastId) {
      // 1. Initial Page Load Event
      trackEvent('page_load', currentCastId);

      // 2. Detect if visitor arrived by clicking "Play Intro" button inside the PDF
      //    URL shape: /final-result/XXX?from=pdf&mode=video&source=pdf
      const fromPdfSource = searchParams.get('source') === 'pdf';
      const modeIsVideo = searchParams.get('mode') === 'video';
      if (fromPdfSource && modeIsVideo) {
        trackEvent('play_intro', currentCastId);
      }

      // 3. Session Duration Tracking
      const handleUnload = () => {
        trackSessionEnd(currentCastId);
      };

      window.addEventListener('beforeunload', handleUnload);
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
      };
    }
  }, [castId, location.search]);

  // ✅ Handle URL query parameters for mode
  useEffect(() => {
    // Set window name to help with targeting from external sources
    window.name = "careercast_main";

    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const fromPdf = params.get('from') === 'pdf' || params.get('source') === 'pdf';

    // Update panel state if URL changes after mount
    if (fromPdf && (mode === 'video' || mode === 'chat' || mode === 'resume')) {
      // PREVENT auto-opening chat if no portfolio exists
      if (mode === 'chat' && !portfolioUrl) {
        console.log("🚫 Blocking chat auto-open: No portfolio available.");
        return;
      }

      if (!isPanelOpen || panelMode !== mode) {
        setPanelMode(mode as 'chat' | 'video' | 'resume');
        setIsPanelOpen(true);
      }
    }
  }, [location.search, isPanelOpen, panelMode, portfolioUrl]);

  // ✅ Load data from localStorage or Supabase
  useEffect(() => {
    const loadData = async () => {
      // Only show top-level loader if we don't have enough initial data
      if (!resumeUrl) {
        setLoading(true);
      }

      try {
        const idFromQuery = searchParams.get('id') || searchParams.get('resumeId');
        const urlFromQuery = searchParams.get('resumeUrl');
        const effectiveId = castId || idFromQuery;

        console.log("🚀 Loading data with:", { user, castId, idFromQuery, effectiveId, urlFromQuery });

        // Check if this is an external visitor (no user but has an ID)
        const isExternal = !user && effectiveId;
        setIsExternalVisitor(!!isExternal);

        if (effectiveId === 'profile') {
          // Special case: API-only resume, no Supabase record exists
          // Load resume + portfolio directly from Vercel API via the fetchVercelDetails effect
          const emailParam = searchParams.get('email');
          if (emailParam) {
            const decodedEmail = decodeURIComponent(emailParam);
            setResumeOwnerEmail(decodedEmail);
            // Also try to get the application email for this user
            supabase
              .from('digital_resume_by_crm')
              .select('company_application_email')
              .eq('email', decodedEmail)
              .maybeSingle()
              .then(({ data: crmUser }) => {
                if (crmUser?.company_application_email) {
                  setResumeOwnerAppEmail(crmUser.company_application_email);
                }
              });
            setJobTitle('Resume');
          } else {
            // No email in URL — fall back to localStorage
            await loadLocalData();
          }
        } else if (effectiveId) {
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
  }, [user, castId, location.search]);

  // ✅ Sync with Vercel User Details API (ONLY source for resume/portfolio)
  useEffect(() => {
    const fetchVercelDetails = async () => {
      const emailsToTry = [resumeOwnerEmail, resumeOwnerAppEmail].filter(Boolean) as string[];
      if (emailsToTry.length === 0) {
        setIsSyncingWithVercel(false);
        return;
      }

      setIsSyncingWithVercel(true);
      let foundPortfolio = false;
      for (const email of emailsToTry) {
        if (foundPortfolio) break;
        const normalizedEmail = email.trim().toLowerCase();
        try {
          const response = await fetch(
            `/api/proxy-applywizz?email=${normalizedEmail}`
          );
          if (response.ok) {
            const jsonResponse = await response.json();
            const userData = Array.isArray(jsonResponse) ? jsonResponse[0] : jsonResponse;
            if (!userData) continue;

            const vResumeUrl = userData?.data?.resume?.pdf_path?.[0] || userData?.resume?.pdf_path?.[0];
            const vPortfolioUrl = userData?.data?.portfolio?.link || userData?.portfolio?.link;

            if (vResumeUrl && typeof vResumeUrl === "string") {
              setResumeUrl(current => {
                // Priority: Use existing resume if it exists (from URL param or previous fetch)
                if (current) return current;

                const fileNameFromUrl = vResumeUrl.split('?')[0].split('/').pop();
                setResumeFileName(fileNameFromUrl || "Resume.pdf");
                return vResumeUrl;
              });

              // ✅ Sync with Supabase if we have a valid ID and a logged-in user
              const currentId = castId || idFromQuery;
              if (user && currentId && currentId !== 'profile') {
                console.log("🔄 Syncing external resume to Supabase for ID:", currentId);
                Promise.all([
                  supabase.from('crm_job_requests').update({ resume_url: vResumeUrl }).eq('id', currentId).is('resume_url', null),
                  supabase.from('job_requests').update({ resume_path: vResumeUrl }).eq('id', currentId).is('resume_path', null)
                ]).then(([crmRes, regRes]) => {
                  if (!crmRes.error || !regRes.error) {
                    console.log("✅ Successfully synced resume path to Supabase");
                  }
                }).catch(err => console.error("❌ Sync failed:", err));
              }
            }

            const isValidVercelUrl =
              typeof vPortfolioUrl === "string" &&
              (vPortfolioUrl.startsWith("http") || vPortfolioUrl.includes("localhost"));

            if (isValidVercelUrl) {
              setPortfolioUrl(vPortfolioUrl || "");
              setTempPortfolioUrl(vPortfolioUrl || "");
              foundPortfolio = true;

              // ✅ Sync Portfolio to Supabase using user_id as the key
              const targetUserId = resumeOwnerUserId || user?.id;
              if (user && targetUserId && vPortfolioUrl) {
                console.log("🔄 Syncing external portfolio to Supabase for user:", targetUserId);
                supabase.from('portfolio_settings')
                  .select('id')
                  .eq('user_id', targetUserId)
                  .maybeSingle()
                  .then(({ data: existing }) => {
                    if (existing) {
                      supabase.from('portfolio_settings')
                        .update({ url: vPortfolioUrl })
                        .eq('user_id', targetUserId)
                        .then(() => console.log("✅ Updated portfolio in Supabase"));
                    } else {
                      supabase.from('portfolio_settings')
                        .insert({ url: vPortfolioUrl, user_id: targetUserId })
                        .then(() => console.log("✅ Inserted new portfolio record in Supabase"));
                    }
                  });
              }
            }
          }
        } catch (err) {
          console.error(`❌ Error fetching Vercel details:`, err);
        }
      }

      if (!foundPortfolio) {
        setPortfolioUrl("");
        setTempPortfolioUrl("");
      }
      setIsSyncingWithVercel(false);
    };

    fetchVercelDetails();
  }, [resumeOwnerEmail, resumeOwnerAppEmail, user, resumeOwnerUserId]);

  const loadLocalData = async () => {
    // First try to get data from localStorage
    const uploadedResumeUrl = localStorage.getItem("uploadedResumeUrl");
    const fileName = localStorage.getItem("resumeFileName");
    const recordedVideoUrl = localStorage.getItem("recordedVideoUrl");
    const jobTitleValue = localStorage.getItem("careercast_jobTitle");
    const currentJobRequestId = localStorage.getItem("current_job_request_id");
    const isCRMUser = localStorage.getItem("is_crm_user") === "true";


    // If we have a job request ID, fetch the portfolio from the new table
    if (currentJobRequestId) {
      try {


        if (isCRMUser) {
          // CRM User - Query crm_job_requests table
          const { data, error } = await supabase
            .from('crm_job_requests')
            .select('*')
            .eq('id', currentJobRequestId)
            .single();

          if (!error && data) {
            setJobTitle(data.job_title || jobTitleValue || "");

            // --- Resume/Portfolio Lookup ---
            if (data.email) {
              setResumeOwnerEmail(data.email);
              console.log("📍 Email detected, logic will prefer Supabase resume if exists.");

              setResumeUrl(data.resume_url || uploadedResumeUrl);
              setResumeFileName(fileName || (data.resume_url ?
                data.resume_url.split('/').pop() || "Resume.pdf" :
                "Resume.pdf"));

              // Fetch CRM record for application email
              supabase
                .from('digital_resume_by_crm')
                .select('company_application_email')
                .eq('email', data.email)
                .maybeSingle()
                .then(({ data: crmUser }) => {
                  if (crmUser?.company_application_email) {
                    setResumeOwnerAppEmail(crmUser.company_application_email);
                  }
                });
            }

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
            // Fetch owner's name and email for mapping
            if (data.user_id || data.email) {
              setResumeOwnerEmail(data.email || null);
              setResumeOwnerUserId(data.user_id || null);
              const { data: profile } = await supabase.from('profiles').select('first_name, last_name, full_name').eq('id', data.user_id).single();
              if (profile) setCandidateName(profile.first_name || profile.full_name?.split(' ')[0] || "Candidate");
            }

            return;
          }
        } else {
          // Regular User - Query job_requests table
          const { data, error } = await supabase
            .from('job_requests')
            .select('*')
            .eq('id', currentJobRequestId)
            .single();

          if (!error && data) {
            setJobTitle(data.job_title || jobTitleValue || "");

            // --- Resume/Portfolio Lookup: Handled by Vercel API Sync ---
            const candidateEmail = (data as any)?.candidate_email || (data as any)?.email || null;
            if (candidateEmail) {
              setResumeOwnerEmail(candidateEmail);
              console.log("📍 Email detected, Vercel sync will handle portfolio.");
            }

            let finalResumeUrl = data.resume_path || uploadedResumeUrl;
            if (finalResumeUrl && !finalResumeUrl.startsWith('http')) {
              try {
                const bucket = isCRMUser ? 'CRM_users_resumes' : 'resumes';
                finalResumeUrl = supabase.storage.from(bucket).getPublicUrl(finalResumeUrl).data.publicUrl;
              } catch (urlError) {
                console.error("Error constructing resume URL:", urlError);
              }
            }
            setResumeUrl(finalResumeUrl);

            setResumeFileName(fileName || data.resume_original_name || (finalResumeUrl ?
              finalResumeUrl.split('/').pop() || "Resume.pdf" :
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
            // Fetch owner's name and email for mapping
            if (data.user_id) {
              setResumeOwnerUserId(data.user_id);
              // Regular job_requests might have email if we check the table schema
              setResumeOwnerEmail((data as any).email || (data as any).candidate_email || null);
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

    // localStorage resume fallback removed (Prioritizing Vercel API ONLY)
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
      console.log("🚀 loadExternalData fetching with ID:", id);
      // Parallelize checking CRM and regular tables
      const [crmResult, regularResult] = await Promise.all([
        supabase.from('crm_job_requests').select('*').eq('id', id).maybeSingle(),
        supabase.from('job_requests').select('*').eq('id', id).maybeSingle()
      ]);

      // Consolidate data from whichever table matched
      const data = crmResult.data || regularResult.data;

      // --- Resume/Portfolio Lookup: Handled by Vercel API Sync ---
      const ownerEmail = (data as any)?.email || (data as any)?.candidate_email || null;
      if (ownerEmail) {
        setResumeOwnerEmail(ownerEmail);
        console.log("📍 Email detected, Vercel sync will handle resume and portfolio.");

        // Fetch CRM record to get application email
        supabase
          .from('digital_resume_by_crm')
          .select('company_application_email')
          .eq('email', ownerEmail)
          .maybeSingle()
          .then(({ data: crmUser }) => {
            if (crmUser?.company_application_email) {
              setResumeOwnerAppEmail(crmUser.company_application_email);
            }
          });
      }
      if (data) {
        console.log("✅ Request record found:", data);
        setJobTitle(data.job_title || "");

        // Handle existing resume URL
        let rawResumeUrl = (data as any).resume_url || (data as any).resume_path;
        if (rawResumeUrl) {
          if (!rawResumeUrl.startsWith('http')) {
            try {
              // Determine bucket based on whether this record came from crm table
              const isCrmRecord = !!crmResult.data;
              const bucket = isCrmRecord ? 'CRM_users_resumes' : 'resumes';
              rawResumeUrl = supabase.storage.from(bucket).getPublicUrl(rawResumeUrl).data.publicUrl;
            } catch (urlError) {
              console.error("Error constructing resume URL:", urlError);
            }
          }
          setResumeUrl(rawResumeUrl);
          setResumeFileName(rawResumeUrl.split('/').pop() || "Resume.pdf");
        }

        // Handle Candidate Name & Portfolio Override
        if (data.user_id) {
          setResumeOwnerUserId(data.user_id);
          setResumeOwnerEmail((data as any).email || (data as any).candidate_email || null);

          // Parallel fetch for profile and portfolio settings
          const [profileRes, portfolioRes] = await Promise.all([
            supabase.from('profiles').select('first_name').eq('id', data.user_id).maybeSingle(),
            supabase.from('portfolio_settings').select('url').eq('user_id', data.user_id).maybeSingle()
          ]);

          if (profileRes.data) setCandidateName(profileRes.data.first_name || "Candidate");
          if (portfolioRes.data?.url) {
            console.log("📍 Found portfolio override in Supabase:", portfolioRes.data.url);
            setPortfolioUrl(portfolioRes.data.url);
            setTempPortfolioUrl(portfolioRes.data.url);
          }
        }

        // --- Fetch Video URL (Checking both tables for robustness) ---
        let finalVideoUrl = null;

        // 1. Try CRM recordings
        const { data: crmVideo } = await supabase
          .from('crm_recordings')
          .select('video_url')
          .eq('job_request_id', id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (crmVideo && crmVideo.length > 0 && crmVideo[0].video_url) {
          const path = crmVideo[0].video_url;
          finalVideoUrl = path.startsWith('http')
            ? path
            : supabase.storage.from('CRM_users_recordings').getPublicUrl(path).data.publicUrl;
          console.log("🎞️ Found CRM video:", finalVideoUrl);
        } else {
          // 2. Try Regular recordings
          const { data: regVideo } = await supabase
            .from('recordings')
            .select('storage_path')
            .eq('job_request_id', id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (regVideo && regVideo.length > 0 && regVideo[0].storage_path) {
            const path = regVideo[0].storage_path;
            finalVideoUrl = path.startsWith('http')
              ? path
              : supabase.storage.from('recordings').getPublicUrl(path).data.publicUrl;
            console.log("🎞️ Found Regular video:", finalVideoUrl);
          }
        }

        setVideoUrl(finalVideoUrl);
      } else {
        console.log("❌ No matching record found for ID:", id);
      }
    } catch (error) {
      console.error("❌ Error loading external data:", error);
    }
  };


  const handleSavePortfolio = async () => {
    const trimmedUrl = tempPortfolioUrl.trim();

    if (trimmedUrl && !trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      showToast("URL must start with http:// or https://", "error");
      return;
    }

    try {
      const currentJobRequestId = castId || localStorage.getItem("current_job_request_id");

      if (!currentJobRequestId) {
        console.error("❌ Save Aborted: currentJobRequestId is missing.");
        showToast("Invalid request ID. Please refresh and try again.", "error");
        return;
      }

      console.log("🛠️ Saving portfolio. State:", { resumeOwnerEmail, resumeOwnerUserId, currentUser: user?.id, currentJobRequestId });

      let targetUserId = null;

      // 1. Try to map via the resume owner's email in the digital_resume_by_crm table
      if (resumeOwnerEmail) {
        const { data: crmMapping } = await supabase
          .from('digital_resume_by_crm')
          .select('user_id')
          .eq('email', resumeOwnerEmail)
          .maybeSingle();

        if (crmMapping?.user_id) {
          targetUserId = crmMapping.user_id;
          console.log("📍 Mapped via email to CRM user_id:", targetUserId);
        }
      }

      // 2. Fallback to the loaded resume's owner ID
      if (!targetUserId) {
        targetUserId = resumeOwnerUserId;
        if (targetUserId) console.log("📍 Using loaded resumeOwnerUserId:", targetUserId);
      }

      // 3. Fallback to current authenticated user
      if (!targetUserId && user?.id) {
        targetUserId = user.id;
        console.log("📍 Using current authenticated user.id:", targetUserId);
      }

      if (!targetUserId) {
        console.error("❌ Save Aborted: targetUserId is missing.");
        showToast("Invalid user session or resume owner not found", "error");
        return;
      }

      // ✅ Upsert portfolio to Supabase (Source of Truth includes manual overrides)
      if (targetUserId) {
        console.log("🔄 Saving portfolio to Supabase for user:", targetUserId);
        const { data: existing } = await supabase.from('portfolio_settings')
          .select('id')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (existing) {
          await supabase.from('portfolio_settings')
            .update({ url: trimmedUrl })
            .eq('user_id', targetUserId);
          console.log("✅ Updated portfolio in Supabase");
        } else {
          await supabase.from('portfolio_settings')
            .insert({ url: trimmedUrl, user_id: targetUserId });
          console.log("✅ Inserted new portfolio record in Supabase");
        }
      }

      setPortfolioUrl(trimmedUrl);
      setIsEditingPortfolio(false);
      showToast("Portfolio updated successfully", "success");


    } catch (err: any) {
      console.error("Error saving portfolio:", err);
      showToast(err.message || "Failed to save portfolio link", "error");
    }
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    // When closing, remove the mode from URL to prevent auto-opening on refresh
    const params = new URLSearchParams(location.search);
    params.delete('mode');
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };
  const enhancePDF = async (resumeUrlStr: string, currentRequestId: string) => {
    try {
      const emailsToTry = [resumeOwnerEmail, resumeOwnerAppEmail].filter(Boolean) as string[];
      const emailParam = emailsToTry[0] ? `&email=${encodeURIComponent(emailsToTry[0])}` : '';
      const resumeUrlParam = resumeUrlStr ? `&resumeUrl=${encodeURIComponent(resumeUrlStr)}` : '';

      // Chat button → this app's own /chat page (portfolio iframe + chat panel side-by-side)
      const hasPortfolio = !!portfolioUrl;
      const chatUrl = hasPortfolio
        ? `${window.location.origin}/chat?resumeId=${currentRequestId}${emailParam}${resumeUrlParam}&portfolio=${encodeURIComponent(portfolioUrl)}&mode=chat`
        : `${window.location.origin}/chat?resumeId=${currentRequestId}${emailParam}${resumeUrlParam}&source=pdf&mode=chat`;

      // Play Intro button → this app's final-result page
      const playIntroUrl = `${window.location.origin}/final-result/${currentRequestId}?from=pdf&mode=video&source=pdf${emailParam}${resumeUrlParam}`;

      const hasVideo = !!videoUrl;

      // Use our robust proxy path to avoid CORS issues when fetching the actual PDF bytes
      const proxiedUrl = getProxiedUrl(resumeUrlStr);

      let response = await fetch(proxiedUrl);
      if (!response.ok) response = await fetch(proxiedUrl, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch PDF");

      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      const btnW_play = 85;
      const btnW_chat = 82;
      const btnH = 20;
      const gap = 10;
      const margin = 20;

      const topMargin = 5;

      const totalW = (hasVideo ? (btnW_play + gap) : 0) + (hasPortfolio ? btnW_chat : 0);
      let currentX = width - totalW - margin;

      const btnY = height - btnH - topMargin;

      const context = pdfDoc.context;

      // Draw Chat Button (Let's talk)
      if (hasPortfolio) {
        const chatButtonDataUrl = await generateButtonImage("Let's talk", "/Vector.svg", btnW_chat, btnH, 15, 13);
        if (chatButtonDataUrl) {
          const chatBytes = await fetch(chatButtonDataUrl).then(r => r.arrayBuffer());
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
      }

      // Draw Play Intro Button
      if (hasVideo) {
        const playButtonDataUrl = await generateButtonImage("Play Intro", "/Frame 215.svg", btnW_play, btnH, 17, 17);
        if (playButtonDataUrl) {
          const playBytes = await fetch(playButtonDataUrl).then(r => r.arrayBuffer());
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

      const isPdf = resumeUrl.toLowerCase().split('?')[0].endsWith('.pdf') || resumeUrl.includes('.pdf?');

      if (!isPdf) {
        showToast("Enhancement is only available for PDF files. Downloading original resume.", "warning");
        const a = document.createElement("a");
        a.href = resumeUrl;
        a.download = resumeFileName;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // ✅ Tracking PDF Download
      trackEvent('pdf_download', currentCastId);

      try {
        const enhancedUrl = await enhancePDF(resumeUrl, currentCastId);
        const userName = candidateName !== "Candidate" ? candidateName : (user?.firstName || user?.name || "Candidate");
        const a = document.createElement("a");
        a.href = enhancedUrl;
        a.download = `${userName}_DIGITALRESUME.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(enhancedUrl), 1000);
      } catch (enhanceErr) {
        console.error("❌ Enhancement failed, falling back to original download:", enhanceErr);

        // Final fallback: Direct download of the original resume
        const a = document.createElement("a");
        a.href = resumeUrl;
        a.download = resumeFileName;
        // For cross-origin S3 URLs, download attribute might be ignored. 
        // target="_blank" ensures it at least opens in a new tab if it can't download.
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("Downloaded original resume (enhancement failed)", "warning");
      }
    } catch (err) {
      console.error("Download process error:", err);
      showToast("Download failed", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">


      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b shadow-md z-[100] h-24 md:h-20">
        <div className="max-w-7xl mx-auto h-full flex items-center gap-3 px-4 shadow-none">
          {user && !isFromPdf && (
            <Button
              variant="outline"
              onClick={() => {
                const isAdmin = sessionStorage.getItem('digital_resume_admin_access') === 'true';
                navigate(isAdmin ? "/digital-resume-dashboard" : "/dashboard");
              }}
              className="flex items-center gap-2 border-gray-300 text-gray-700 h-10 shrink-0 px-3"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </Button>
          )}
          {user && !isFromPdf && portfolioUrl && (
            <div className="flex items-center shrink-0">
              {isEditingPortfolio ? (
                <div className="flex items-center gap-2 bg-white border border-blue-400 rounded-xl p-1 pr-2 shadow-md animate-in fade-in zoom-in duration-200 h-11">
                  <input
                    type="text"
                    placeholder="https://yourportfolio.com"
                    value={tempPortfolioUrl}
                    onChange={(e) => setTempPortfolioUrl(e.target.value)}
                    className="h-full px-3 bg-transparent border-none text-sm focus:outline-none w-48 xl:w-64"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavePortfolio();
                      if (e.key === 'Escape') setIsEditingPortfolio(false);
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSavePortfolio}
                      className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                      title="Save"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingPortfolio(false)}
                      className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors shadow-sm"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="group relative rounded-xl p-[1px] bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400 shadow-sm transition-all duration-300 cursor-pointer shrink-0"
                  onClick={() => {
                    setTempPortfolioUrl(portfolioUrl);
                    setIsEditingPortfolio(true);
                  }}
                >
                  <div className="bg-white rounded-[11px] h-11 px-4 flex items-center gap-3 transition-colors">
                    <div className="flex items-center justify-center w-8 h-8 bg-gray-50 rounded-lg transition-all duration-300">
                      <Link2 className="h-4 w-4 text-gray-400 transition-all duration-300" />
                    </div>

                    <div className="flex flex-col justify-center min-w-0">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 leading-tight">
                        Portfolio
                      </span>
                      {portfolioUrl ? (
                        <div className="text-sm font-bold text-gray-800 truncate max-w-[120px] xl:max-w-[220px] leading-tight">
                          {portfolioUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-gray-300 leading-tight">
                          No portfolio added
                        </span>
                      )}
                    </div>

                    <div className="ml-auto p-1.5 text-gray-400 rounded-lg transition-all hover:bg-gray-100">
                      <Pencil className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Primary Action Group: Visible to both owner and visitor */}
          {!isFromPdf && (user || isExternalVisitor) && (
            <>
              <Button
                variant="outline"
                onClick={handleDownloadEnhanced}
                className="flex items-center gap-2 border-blue-500 text-blue-600 h-10 px-3 md:px-4 shrink-0 transition-opacity"
                disabled={!resumeUrl || loading || isSyncingWithVercel}
              >
                {loading || isSyncingWithVercel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span className="text-sm font-semibold hidden sm:inline">Download Enhanced Resume</span>
                <span className="text-sm font-semibold sm:hidden">Download</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  const currentCastId = castId || idFromQuery || localStorage.getItem("current_job_request_id");
                  const emailsToTry = [resumeOwnerEmail, resumeOwnerAppEmail].filter(Boolean) as string[];
                  const emailParamValue = emailsToTry[0] ? `?email=${encodeURIComponent(emailsToTry[0])}` : '';
                  const shareableLink = `${window.location.origin}/final-result/${currentCastId || "profile"}${emailParamValue}`;
                  navigator.clipboard.writeText(shareableLink).then(() => showToast('Link copied to clipboard! Share the link.', 'success'));
                }}
                className="flex items-center gap-2 border-green-500 text-green-600 h-10 px-3 md:px-4 shrink-0"
              >
                <Link className="h-4 w-4" />
                <span className="text-sm font-semibold hidden sm:inline">Copy Link</span>
                <span className="text-sm font-semibold sm:hidden">Copy</span>
              </Button>
            </>
          )}

          {videoUrl && (
            <button
              onClick={() => {
                const currentCastId = castId || idFromQuery || "profile";
                trackEvent('play_intro', currentCastId);
                const params = new URLSearchParams(location.search);
                params.set('mode', 'video');
                navigate(`${location.pathname}?${params.toString()}`, { replace: true });
                setPanelMode('video');
                setIsPanelOpen(true);
              }}
              className="flex items-center justify-center gap-2 h-10 px-3 md:px-4 rounded-md text-sm font-bold bg-[#0A66C2] text-white border border-[#CEDFF9] hover:brightness-110 shadow-sm transition-all shrink-0 whitespace-nowrap"
            >
              <Play className="w-4 h-4" />
              <span>Play Intro</span>
            </button>
          )}

          {!!portfolioUrl && (
            <button
              onClick={() => {
                const currentCastId = castId || idFromQuery || "profile";
                const emailsToTry = [resumeOwnerEmail, resumeOwnerAppEmail].filter(Boolean) as string[];
                const emailParamValue = emailsToTry[0] ? `&email=${encodeURIComponent(emailsToTry[0])}` : '';
                const resumeUrlParam = resumeUrl ? `&resumeUrl=${encodeURIComponent(resumeUrl)}` : '';
                trackEvent('lets_talk', currentCastId);
                const chatUrl = `/chat?resumeId=${currentCastId}${emailParamValue}${resumeUrlParam}&portfolio=${encodeURIComponent(portfolioUrl)}&mode=chat`;
                navigate(chatUrl);
              }}
              className="flex items-center justify-center gap-2 h-10 px-3 md:px-4 rounded-md text-sm font-bold bg-[#0A66C2] text-white border border-[#CEDFF9] hover:brightness-110 shadow-sm transition-all shrink-0 whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Let's talk</span>
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {user && !isFromPdf && (
              <Button variant="outline" onClick={handleLogout} className="h-10 px-4 border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors shrink-0">
                <LogOut className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Logout</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="relative pt-28 md:pt-24 pb-10 min-h-screen scrollbar-hide">
        <div className="w-full max-w-7xl mx-auto px-4 pt-5">
          {resumeUrl ? (
            <div className="w-full bg-white shadow-2xl rounded-xl border border-slate-200 overflow-hidden relative">
              {/* Optional: Add a notice for Word docs */}
              {(resumeUrl.toLowerCase().endsWith('.docx') || resumeUrl.toLowerCase().endsWith('.doc')) && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <p className="text-xs text-amber-800 font-medium">
                    Viewing Word Document. For the best experience and to use the "Enhanced Resume" features, we recommend uploading a <strong>PDF</strong>.
                  </p>
                </div>
              )}

              <iframe
                src={
                  resumeUrl.toLowerCase().endsWith('.docx') || resumeUrl.toLowerCase().endsWith('.doc')
                    ? `https://docs.google.com/gview?url=${encodeURIComponent(resumeUrl)}&embedded=true`
                    : `${getProxiedUrl(resumeUrl)}#zoom=100&view=FitH`
                }
                title="Resume Preview"
                className="w-full border-0 min-h-[1100px]"
                style={{ display: 'block', width: '100%' }}
                allowFullScreen
              />
            </div>
          ) : (loading || isSyncingWithVercel) ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="min-h-[400px] flex items-center justify-center text-gray-500">No resume available.</div>
          )}
        </div>
      </div>



      {
        isPanelOpen && (
          <ResumeChatPanel
            isOpen={isPanelOpen}
            onClose={closePanel}
            mode={panelMode}
            videoUrl={videoUrl}
            resumeUrl={resumeUrl}
            ownerId={resumeOwnerUserId}
            onModeChange={(m: 'chat' | 'video' | 'resume') => setPanelMode(m)}
            onDownload={handleDownloadEnhanced}
            isDataLoading={loading}
            recruiterMode={true}
          />
        )
      }
    </div >
  );
};

export default FinalResult;
