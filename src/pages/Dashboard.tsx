import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import {
  Menu,
  Loader2,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import ResumeWorkspace from '../features/resume-dashboard/components/ResumeWorkspace';
import { apiUrl } from '../lib/apiBase';
import { getUserInfo } from '../utils/crmHelpers';
import { resolveRecordingUrl } from '../utils/recordingHelpers';
import { showToast } from "../components/ui/toast";
import AnalyticsPanel from '../components/AnalyticsPanel';
import { viewDocumentSafe } from '../utils/documentUtils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tierChecked, setTierChecked] = useState(false);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect customers without 'digital_resume' tier
  useEffect(() => {
    let cancelled = false;
    const checkTier = async () => {
      if (!user) { setTierChecked(true); return; }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { if (!cancelled) setRedirect('/auth'); return; }

        let t: string | null = null;
        const res = await fetch(apiUrl('/api/v1/subscription/me'), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const body = await res.json();
          t = body?.data?.tier ?? null;
        }

        // Client fallback when API is unavailable
        if (t !== 'career_identity' && t !== 'digital_resume') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tier')
            .eq('id', session.user.id)
            .maybeSingle();
          if (profile?.tier === 'career_identity' || profile?.tier === 'digital_resume') {
            t = profile.tier;
          } else if (profile || localStorage.getItem('is_crm_user') === 'true') {
            t = 'digital_resume';
          }
        }

        if (t === 'career_identity') { if (!cancelled) setRedirect('/career-identity-dashboard'); return; }
        if (t !== 'digital_resume') { if (!cancelled) setRedirect('/'); return; }
        if (!cancelled) setTierChecked(true);
      } catch { if (!cancelled) setRedirect('/'); }
    };
    checkTier();
    return () => { cancelled = true; };
  }, [user]);
      if (error) throw error;

      const credits = data.credits_remaining || 0;
      const active = credits > 0;

      setIsPremiumActive(active);
      setCredits(credits);
      const emailKey = user.email.replace(/[^a-zA-Z0-9]/g, '_');
      localStorage.setItem(`last_premium_active_${emailKey}`, active.toString());
      localStorage.setItem(`last_credits_${emailKey}`, credits.toString());
      console.log('Regular User credits:', credits);
    } catch (err) {
      console.error('Error fetching plan:', err);
      setIsPremiumActive(false);
    }
  };

  // 🟢 Fetch user’s careercasts
  useEffect(() => {
    if (!user) return;
    fetchcareercasts();
  }, [user]);

  const fetchcareercasts = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Fetch global portfolio settings
      const { data: portData } = await supabase.from('portfolio_settings').select('url').eq('user_id', user.id).maybeSingle();
      if (portData?.url) setPortfolioSettingsUrl(portData.url);

      // Check if CRM user
      const userInfo = await getUserInfo(user.id);
      setIsCRM(userInfo.isCRMUser);
      setCRMEmail(userInfo.email);

      if (userInfo.isCRMUser) {
        const emails = [userInfo.email, userInfo.company_application_email].filter(Boolean) as string[];

        const fetchVercelData = async () => {
          for (const email of emails) {
            try {
              const res = await fetch(`/api/proxy-applywizz?email=${encodeURIComponent(email.trim().toLowerCase())}`);
              if (res.ok) {
                const json = await res.json();
                const d = Array.isArray(json) ? json[0] : json;
                if (d) return d;
              }
            } catch (e) { }
          }
          return null;
        };

        // Fetch Vercel details for the CRM user
        const vercelPromise = fetchVercelData();

        // crm_job_requests has no vercel_portfolio_url column. Portfolio comes from
        // portfolio_settings and the ApplyWizz CRM API after this query succeeds.
        const crmPromise = (async () => {
          const responses = await Promise.all(
            emails.map((email) =>
              supabase
                .from('crm_job_requests')
                .select(`
                  id,
                  job_title,
                  job_description,
                  resume_url,
                  application_status,
                  created_at
                `)
                .eq('email', email)
                .order('created_at', { ascending: false })
            )
          );

          const failed = responses.find((result) => result.error);
          if (failed?.error) {
            return { data: null as null, error: failed.error };
          }

          const merged = responses
            .flatMap((result) => result.data || [])
            .filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          return { data: merged, error: null };
        })();

        const [crmResult, vercelData] = await Promise.all([
          crmPromise,
          vercelPromise
        ]);

        if (crmResult.error) {
          console.error("Failed to fetch CRM job requests:", crmResult.error);
          return;
        }
        const data = crmResult.data;

        // Fetch recordings and session details for each job request
        // Correctly extract resume URL and portfolio from the nested API structure
        const vApiResumeUrl = vercelData?.data?.resume?.pdf_path?.[0] || vercelData?.resume?.pdf_path?.[0] || null;
        const vApiPort = vercelData?.data?.portfolio?.link || vercelData?.portfolio?.link || null;
        const vApiPortfolio = (typeof vApiPort === "string" && /^https?:\/\//i.test(vApiPort)) ? vApiPort : null;
        const vApiName = vercelData?.data?.name || vercelData?.name || null;

        const supabaseJobs = data || [];

        // If no Supabase records exist but API has a resume → create a synthetic record
        if (supabaseJobs.length === 0 && vApiResumeUrl) {
          const primaryEmail = emails[0]; // personal email (first priority)
          const fallbackVideo = await resolveRecordingUrl({
            isCRM: true,
            email: primaryEmail,
            userId: user.id,
          });
          const syntheticRecord = {
            id: 'api-resume',
            job_title: `${vApiName ? vApiName + "'s" : 'Your'} Resume`,
            job_description: '',
            resume_path: vApiResumeUrl,
            status: 'ready',
            created_at: new Date().toISOString(),
            recordings: fallbackVideo ? [{ storage_path: fallbackVideo }] : [],
            view_count: 0,
            engaged_count: 0,
            vercel_portfolio_url: vApiPortfolio,
            is_api_resume: true,
            owner_email: primaryEmail
          };
          setcareercasts([syntheticRecord]);
        } else {
          const jobsWithDetails = await Promise.all(
            supabaseJobs.map(async (item) => {
              const [recRes, sessionRes, engagedRes, portRes] = await Promise.all([
                supabase.from('crm_recordings')
                  .select('video_url')
                  .eq('job_request_id', item.id)
                  .order('created_at', { ascending: false })
                  .limit(1),
                supabase.from('resume_sessions').select('id', { count: 'exact', head: true }).eq('resume_id', item.id),
                supabase.from('resume_sessions').select('id', { count: 'exact', head: true })
                  .eq('resume_id', item.id)
                  .or('video_clicked.eq.true,chat_opened.eq.true,pdf_downloaded.eq.true,portfolio_clicked.eq.true'),
                supabase.from('portfolio_settings').select('url').eq('request_id', item.id).maybeSingle()
              ]);

              const linkedVideo = !recRes.error ? recRes.data?.[0]?.video_url : null;
              const recordingUrl = linkedVideo
                ? (linkedVideo.startsWith('http')
                  ? linkedVideo
                  : supabase.storage.from('CRM_users_recordings').getPublicUrl(linkedVideo).data.publicUrl)
                : await resolveRecordingUrl({ isCRM: true, jobRequestId: item.id });

              return {
                ...item,
                // Priority: Supabase resume first, then API resume as fallback
                resume_path: item.resume_url || vApiResumeUrl || null,
                status: item.application_status || 'draft',
                recordings: recordingUrl ? [{ storage_path: recordingUrl }] : [],
                view_count: sessionRes.count || 0,
                engaged_count: engagedRes.count || 0,
                vercel_portfolio_url: portRes.data?.url || vApiPortfolio
              };
            })
          );

          if (!jobsWithDetails.some((job) => job.recordings.length > 0)) {
            const fallbackVideo = await resolveRecordingUrl({
              isCRM: true,
              email: emails[0] || user.email,
              userId: user.id,
            });
            if (fallbackVideo && jobsWithDetails[0]) {
              jobsWithDetails[0] = {
                ...jobsWithDetails[0],
                recordings: [{ storage_path: fallbackVideo }],
              };
            }
          }

          setcareercasts(jobsWithDetails);
          const emailKey = user.email.replace(/[^a-zA-Z0-9]/g, '_');
          localStorage.setItem(`last_careercasts_${emailKey}`, JSON.stringify(jobsWithDetails));
        }
      } else {
        // Regular User branch — these users are NOT in the Vercel/ApplyWizz system
        // so we do NOT call the external API (would always 404 for them).

        // Fetch from regular tables
        const { data, error } = await supabase
          .from('job_requests')
          .select(`
            id,
            job_title,
            job_description,
            resume_path,
            status,
            created_at,
            vercel_portfolio_url
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch session counts and engagement for regular user
        const jobsWithViews = await Promise.all(
            (data || []).map(async (item) => {
              const [recRes, sessionRes, engagedRes, portRes] = await Promise.all([
                supabase.from('recordings')
                  .select('storage_path')
                  .eq('job_request_id', item.id)
                  .order('created_at', { ascending: false })
                  .limit(1),
                supabase.from('resume_sessions').select('id', { count: 'exact', head: true }).eq('resume_id', item.id),
                supabase.from('resume_sessions').select('id', { count: 'exact', head: true })
                  .eq('resume_id', item.id)
                  .or('video_clicked.eq.true,chat_opened.eq.true,pdf_downloaded.eq.true,portfolio_clicked.eq.true'),
                supabase.from('portfolio_settings').select('url').eq('request_id', item.id).maybeSingle()
              ]);

              const linkedVideo = !recRes.error ? recRes.data?.[0]?.storage_path : null;
              const recordingUrl = linkedVideo
                || await resolveRecordingUrl({ isCRM: false, jobRequestId: item.id });

              return {
                ...item,
                resume_path: item.resume_path || null,
                recordings: recordingUrl ? [{ storage_path: recordingUrl }] : [],
                view_count: sessionRes.count || 0,
                engaged_count: engagedRes.count || 0,
                vercel_portfolio_url: portRes.data?.url || (item as any).vercel_portfolio_url || null
              };
            })
        );

        if (!jobsWithViews.some((job) => job.recordings.length > 0)) {
          const fallbackVideo = await resolveRecordingUrl({
            isCRM: false,
            email: user.email,
            userId: user.id,
          });
          if (fallbackVideo && jobsWithViews[0]) {
            jobsWithViews[0] = {
              ...jobsWithViews[0],
              recordings: [{ storage_path: fallbackVideo }],
            };
          }
        }

        setcareercasts(jobsWithViews);
        const emailKey = user.email.replace(/[^a-zA-Z0-9]/g, '_');
        localStorage.setItem(`last_careercasts_${emailKey}`, JSON.stringify(jobsWithViews));
      }
    } catch (error) {
      console.error('Error fetching Network Notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceClick = (id: string) => {
    setReplacingId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingId || !user) return;
    
    setSelectedReplaceFile(file);
    setShowReplaceModal(true);
  };

  const confirmReplace = async () => {
    if (!selectedReplaceFile || !replacingId || !user) return;

    // Guard: do not attempt to update Supabase with a non-UUID id
    if (!isSafeUUID(replacingId)) {
      // Synthetic/API-only record — there is no Supabase row to update.
      // Simply re-upload and refresh the display without touching Supabase.
      try {
        setIsReplacing(true);
        const file = selectedReplaceFile;
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const timestamp = Date.now();
        const fileName = `replaced_resume_${timestamp}.${fileExt}`;
        const filePath = `${crmEmail || user.email}/${fileName}`;
        await supabase.storage.from('CRM_users_resumes').upload(filePath, file, { upsert: true, contentType: file.type || 'application/pdf' });
        showToast("Resume replaced (API-only record — no Supabase row to update).", "success");
        await fetchcareercasts();
        setShowReplaceModal(false);
      } catch (err: any) {
        console.error('❌ Replace failed for synthetic record:', err);
        showToast("Failed to replace resume: " + err.message, "error");
      } finally {
        setIsReplacing(false);
        setReplacingId(null);
        setSelectedReplaceFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }

    try {
      setIsReplacing(true);
      const file = selectedReplaceFile;
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const timestamp = Date.now();
      const fileName = `replaced_resume_${timestamp}.${fileExt}`;

      let publicUrl: string | null = null;

      if (isCRM && crmEmail) {
        // CRM User - Upload to CRM bucket
        const filePath = `${crmEmail}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('CRM_users_resumes')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type || 'application/pdf'
          });
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('CRM_users_resumes')
          .getPublicUrl(filePath);
        publicUrl = publicData?.publicUrl ?? null;

        // Update crm_job_requests (safe: replacingId is a valid UUID here)
        const { error: updateError } = await supabase.from('crm_job_requests')
          .update({
            resume_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', replacingId);

        if (updateError) throw updateError;

        // Also update crm_resumes for consistency
        await supabase.from('crm_resumes').insert({
          email: crmEmail,
          user_id: user.id,
          resume_name: file.name,
          resume_url: publicUrl,
          file_type: fileExt,
          file_size: file.size,
        });

      } else {
        // Regular User - Upload to regular bucket
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type || 'application/pdf'
          });
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('resumes')
          .getPublicUrl(filePath);
        publicUrl = publicData?.publicUrl ?? null;

        // Update job_requests
        const { error: updateError } = await supabase.from('job_requests')
          .update({
            resume_path: publicUrl,
            resume_original_name: file.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', replacingId);

        if (updateError) throw updateError;
      }

      showToast("Resume replaced successfully!", "success");
      fetchcareercasts(); // Refresh the list
      setShowReplaceModal(false);

      // Automatically redirect to download the newly replaced resume
      setTimeout(() => {
        navigate(`/final-result/${replacingId}?autoDownload=true`);
      }, 1500);
    } catch (err: any) {
      console.error("❌ Replace failed:", err);
      showToast("Failed to replace resume: " + err.message, "error");
    } finally {
      setIsReplacing(false);
      setReplacingId(null);
      setSelectedReplaceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 🟢 Handle new careercast click
  const handleNewCast = () => {
    if (credits > 0) {
      // ✅ Has credits → allow recording
      // Clear previous session data to ensure a fresh record is created
      localStorage.removeItem('current_job_request_id');
      localStorage.removeItem('uploadedResumeUrl');
      localStorage.removeItem('resumeFileName');
      localStorage.removeItem('resumeFullText');
      localStorage.removeItem('teleprompterText');
      
      // Skip Step 1 and go directly to Step 1 (Upload Resume) — mark as new so history is hidden
      navigate('/step1?mode=new');
    } else {
      // ⛔ No credits → show upgrade popup
      setShowPricingPopup(true);
    }
  };

  const populateLocalStorage = (cast: any) => {
    // Populate localStorage so steps can resume correctly
    localStorage.setItem('careercast_jobTitle', cast.job_title || '');
    localStorage.setItem('careercast_jobDescription', cast.job_description || '');
    // ⚠️ Only store a real UUID as current_job_request_id.
    // Synthetic/API-only records (is_api_resume: true) have a slug id like
    // "api-resume" which must NEVER be sent to Supabase UUID columns.
    // For those, we store 'profile' as the sentinel instead.
    const safeId = isSafeUUID(cast.id) ? cast.id : 'profile';
    localStorage.setItem('current_job_request_id', safeId);
    localStorage.setItem('uploadedResumeUrl', cast.resume_path || '');
    localStorage.setItem('resumeFileName', cast.resume_path ? cast.resume_path.split('/').pop() : 'Resume.pdf');
    localStorage.setItem('is_crm_user', isCRM ? 'true' : 'false');
    if (isCRM && crmEmail) {
      localStorage.setItem('crm_user_email', crmEmail);
    }
    // --- PARSE SPEED AND TEXT ---
    let actualScript = cast.job_description || '';
    let savedSpeed = '1.0';
    
    if (actualScript.startsWith('[[SPEED:')) {
      const match = actualScript.match(/^\[\[SPEED:([\d.]+)\]\]\s*([\s\S]*)/);
      if (match) {
        savedSpeed = match[1];
        actualScript = match[2];
      }
    }

    localStorage.setItem('teleprompterText', actualScript);
    localStorage.setItem('teleprompterSpeed', savedSpeed);
    
    return { actualScript, savedSpeed };
  };

  const handleReRecord = (cast: any) => {
    const { actualScript } = populateLocalStorage(cast);
    
    // Mark this session as a re-record so generate-introduction logs task_type='rerecording'
    localStorage.setItem('recording_task_type', 'rerecording');

    // Check if the script is just the placeholder
    const isPlaceholder = actualScript === "Generated from resume analysis";

    // If they already have a video AND a real script, jumping directly to record makes sense (Re-record)
    // If they DON'T have a video, OR the script is missing/placeholder, take them to Step 2
    const hasVideo = cast.recordings && cast.recordings.length > 0;
    
    if (hasVideo && !isPlaceholder) {
      navigate(`/record${isCRM ? '?mode=crm' : ''}`);
    } else {
      navigate('/step2?mode=continue');
    }
  };

  const handleContinue = (cast: any) => {
    populateLocalStorage(cast);
    navigate('/step1?mode=continue');
  };
  const handleViewDetails = (id: string, resumePath?: string) => {
    // For synthetic/API-only records (id is not a real UUID like 'api-resume'),
    // navigate with 'profile' so FinalResult uses the email-based lookup
    // instead of firing an invalid UUID query against Supabase.
    const safeId = isSafeUUID(id) ? id : 'profile';
    navigate(`/final-result/${safeId}`);
  };
  const handleCloseVideo = () => setSelectedVideo(null);
  const handleClosePricingPopup = () => setShowPricingPopup(false);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (redirect) return <Navigate to={redirect} replace />;
  if (!tierChecked) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B4F6C]" /></div>;

  return (
    <div className="min-h-screen bg-white flex">
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 w-auto transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 transition-[width,transform] duration-300 ease-in-out`}
      >
        <Sidebar userEmail={user?.email || ''} onLogout={handleLogout} />
      </div>

      {/* Main Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-700 hover:bg-gray-100"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="font-bold text-xl text-[#0B4F6C]">Digital Resume</div>
          <div className="w-10"></div>
        </div>

        {/* Shared ResumeWorkspace */}
        <ResumeWorkspace user={user} onLogout={handleLogout} />
      </div>
    </div>
  );
}
