import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import {
  Video,
  CheckCircle,
  Plus,
  FileText,
  Play,
  Redo,
  Clock,
  Loader2,
  X,
  Menu,
  FileUp,
  BarChart3,
  Link,
  ExternalLink,
  Wallet,
  Sparkles,
  Coins,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { getUserInfo } from '../utils/crmHelpers';
import { showToast } from "../components/ui/toast";
import AnalyticsPanel from '../components/AnalyticsPanel';
import { viewDocumentSafe } from '../utils/documentUtils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Synchronous initialization helper to prevent UI flickers
  const getInitialValue = (keySuffix: string, fallback: any) => {
    const userData = localStorage.getItem('userData');
    if (!userData) return fallback;
    try {
      const parsed = JSON.parse(userData);
      if (!parsed.email) return fallback;
      const emailKey = parsed.email.replace(/[^a-zA-Z0-9]/g, '_');
      const saved = localStorage.getItem(`last_${keySuffix}_${emailKey}`);
      if (saved === null) return fallback;
      if (typeof fallback === 'number') return parseInt(saved);
      if (typeof fallback === 'boolean') return saved === 'true';
      return JSON.parse(saved);
    } catch { return fallback; }
  };

  const [careercasts, setcareercasts] = useState<any[]>(() => getInitialValue('careercasts', []));
  const [loading, setLoading] = useState(() => {
    const data = getInitialValue('careercasts', null);
    return data === null; // Only show loader if we have NO cached data at all for this user
  });
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showPricingPopup, setShowPricingPopup] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userCountry, setUserCountry] = useState<"US" | "GB" | "OTHER">("OTHER");

  // Analytics Panel State
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsId, setAnalyticsId] = useState<string | null>(null);
  const [analyticsTitle, setAnalyticsTitle] = useState('');

  // New: Premium plan tracking
  const [isPremiumActive, setIsPremiumActive] = useState(() => getInitialValue('premium_active', false));
  const [credits, setCredits] = useState<number>(() => getInitialValue('credits', 0));

  // CRM user tracking
  const [isCRM, setIsCRM] = useState(false);
  const [crmEmail, setCRMEmail] = useState<string | null>(null);
  const [portfolioSettingsUrl, setPortfolioSettingsUrl] = useState<string | null>(null);

  const [latestOverallVideo, setLatestOverallVideo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedReplaceFile, setSelectedReplaceFile] = useState<File | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // ✅ Initialize user-specific data once user is available
  useEffect(() => {
    if (!user) return;

    // Clear state if we previously had data for a different user (redundant but safe)
    const emailKey = user.email.replace(/[^a-zA-Z0-9]/g, '_');

    const savedCasts = localStorage.getItem(`last_careercasts_${emailKey}`);
    if (savedCasts) {
      setcareercasts(JSON.parse(savedCasts));
      setLoading(false);
    } else {
      setcareercasts([]);
      setLoading(true);
    }

    const savedActive = localStorage.getItem(`last_premium_active_${emailKey}`);
    if (savedActive) setIsPremiumActive(savedActive === 'true');

    const savedCredits = localStorage.getItem(`last_credits_${emailKey}`);
    if (savedCredits) setCredits(parseInt(savedCredits));

  }, [user]);

  // 🟢 Check plan on mount + realtime updates
  useEffect(() => {
    if (!user) return;
    fetchPlan();

    // Live updates (listen for plan changes in both tables)
    const channel = supabase
      .channel('plan-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          console.log('Profile updated:', payload);
          const credits = payload.new.credits_remaining || 0;
          const active = credits > 0;
          setIsPremiumActive(active);
          setCredits(credits);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'digital_resume_by_crm', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('CRM credits updated:', payload);
          const credits = payload.new.credits_remaining || 0;
          const active = credits > 0 && payload.new.is_active;
          setIsPremiumActive(active);
          setCredits(credits);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 🟢 Fetch plan info from profiles OR digital_resume_by_crm
  const fetchPlan = async () => {
    if (!user) return;
    try {
      // First check if this is a CRM user
      const { data: crmData } = await supabase
        .from('digital_resume_by_crm')
        .select('credits_remaining, is_active')
        .eq('user_id', user.id)
        .maybeSingle();

      if (crmData) {
        // CRM User - get credits from digital_resume_by_crm
        const credits = crmData.credits_remaining || 0;
        const active = credits > 0 && crmData.is_active;

        setIsPremiumActive(active);
        setCredits(credits);
        const emailKey = user.email.replace(/[^a-zA-Z0-9]/g, '_');
        localStorage.setItem(`last_premium_active_${emailKey}`, active.toString());
        localStorage.setItem(`last_credits_${emailKey}`, credits.toString());
        console.log('CRM User credits:', credits);
        return;
      }

      // Regular User - get credits from profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('plan_tier, plan_status, credits_remaining')
        .eq('id', user.id)
        .single();

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
      let absoluteLatestVideo: string | null = null;

      // Fetch global portfolio settings
      const { data: portData } = await supabase.from('portfolio_settings').select('url').eq('user_id', user.id).maybeSingle();
      if (portData?.url) setPortfolioSettingsUrl(portData.url);

      // Check if CRM user
      const userInfo = await getUserInfo(user.id);
      setIsCRM(userInfo.isCRMUser);
      setCRMEmail(userInfo.email);

      const emails = [userInfo.email, userInfo.company_application_email, user.email].filter(Boolean) as string[];

      // 1. Fetch Absolute Latest Video for this identity (Fallback)
      const [overallCrmVideo, overallRecVideo] = await Promise.all([
        supabase.from('crm_recordings').select('video_url, created_at').in('email', emails).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('recordings').select('storage_path, created_at').or(`email.in.(${emails.map(e => `"${e}"`).join(',')}),user_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(1).maybeSingle()
      ]);

      const crmV = overallCrmVideo?.data;
      const recV = overallRecVideo?.data;
      if (crmV && recV) {
        absoluteLatestVideo = new Date(crmV.created_at) > new Date(recV.created_at) ? crmV.video_url : recV.storage_path;
      } else {
        absoluteLatestVideo = crmV?.video_url || recV?.storage_path || null;
      }
      setLatestOverallVideo(absoluteLatestVideo);

      if (userInfo.isCRMUser) {
        const fetchVercelData = async () => {
          for (const email of emails) {
            try {
              const res = await fetch(`/api/proxy-applywizz?email=${email}`);
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

        // Fetch from CRM tables with recordings
        const [crmResult, vercelData] = await Promise.all([
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
            .in('email', emails)
            .order('created_at', { ascending: false }),
          vercelPromise
        ]);

        if (crmResult.error) throw crmResult.error;
        const data = crmResult.data;

        // Fetch recordings and session details for each job request
        // Correctly extract resume URL and portfolio from the nested API structure
        const vApiResumeUrl = vercelData?.data?.resume?.pdf_path?.[0] || vercelData?.resume?.pdf_path?.[0] || null;
        const vApiPort = vercelData?.data?.portfolio?.link || vercelData?.portfolio?.link || null;
        const vApiPortfolio = (typeof vApiPort === "string" && vApiPort.toLowerCase().includes('vercel.app')) ? vApiPort : null;
        const vApiName = vercelData?.data?.name || vercelData?.name || null;

        const supabaseJobs = data || [];

        // If no Supabase records exist but API has a resume → create a synthetic record
        if (supabaseJobs.length === 0 && vApiResumeUrl) {
          const primaryEmail = emails[0]; // personal email (first priority)
          const syntheticRecord = {
            id: 'api-resume',
            job_title: `${vApiName ? vApiName + "'s" : 'Your'} Resume`,
            job_description: '',
            resume_path: vApiResumeUrl,
            status: 'ready',
            created_at: new Date().toISOString(),
            recordings: absoluteLatestVideo ? [{ storage_path: absoluteLatestVideo }] : [],
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
              const [recRes, sessionRes, engagedRes] = await Promise.all([
                supabase.from('crm_recordings').select('video_url').eq('job_request_id', item.id).order('created_at', { ascending: false }).limit(1),
                supabase.from('resume_sessions').select('id', { count: 'exact', head: true }).eq('resume_id', item.id),
                supabase.from('resume_sessions').select('id', { count: 'exact', head: true })
                  .eq('resume_id', item.id)
                  .or('video_clicked.eq.true,chat_opened.eq.true,pdf_downloaded.eq.true,portfolio_clicked.eq.true')
              ]);

              return {
                ...item,
                // Priority: Supabase resume first, then API resume as fallback
                resume_path: item.resume_url || vApiResumeUrl || null,
                status: item.application_status === 'recorded' || recRes.data?.length || absoluteLatestVideo ? 'recorded' : (item.application_status || 'ready'),
                recordings: recRes.data?.length
                  ? recRes.data.map(r => ({ storage_path: r.video_url }))
                  : (absoluteLatestVideo ? [{ storage_path: absoluteLatestVideo }] : []),
                view_count: sessionRes.count || 0,
                engaged_count: engagedRes.count || 0,
                vercel_portfolio_url: vApiPortfolio
              };
            })
          );
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
            recordings (storage_path)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch session counts and engagement for regular user
        const jobsWithViews = await Promise.all(
          (data || []).map(async (item) => {
            const [sessionRes, engagedRes] = await Promise.all([
              supabase.from('resume_sessions').select('id', { count: 'exact', head: true }).eq('resume_id', item.id),
              supabase.from('resume_sessions').select('id', { count: 'exact', head: true })
                .eq('resume_id', item.id)
                .or('video_clicked.eq.true,chat_opened.eq.true,pdf_downloaded.eq.true,portfolio_clicked.eq.true')
            ]);

            return {
              ...item,
              resume_path: item.resume_path || null,
              status: item.status === 'recorded' || item.recordings?.length || absoluteLatestVideo ? 'recorded' : (item.status || 'ready'),
              recordings: item.recordings?.length
                ? item.recordings
                : (absoluteLatestVideo ? [{ storage_path: absoluteLatestVideo }] : []),
              view_count: sessionRes.count || 0,
              engaged_count: engagedRes.count || 0,
              vercel_portfolio_url: null
            };
          })
        );

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

        // Update crm_job_requests
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

  const handleReRecord = (cast: any) => {
    // Populate localStorage so steps can resume correctly
    localStorage.setItem('careercast_jobTitle', cast.job_title || '');
    localStorage.setItem('careercast_jobDescription', cast.job_description || '');
    localStorage.setItem('current_job_request_id', cast.id);
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
  const handleViewDetails = (id: string, resumePath?: string) => {
    // We remove the resumeUrl from the query string to hide sensitive information
    // FinalResult.tsx is capable of fetching the resume URL from the database using the ID
    navigate(`/final-result/${id}`);
  };
  const handleCloseVideo = () => setSelectedVideo(null);
  const handleClosePricingPopup = () => setShowPricingPopup(false);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const getBadge = (status: string) => {
    switch (status) {
      case 'recorded':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-md text-xs font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Recorded
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-md text-xs font-medium">
            <Clock className="w-3.5 h-3.5" /> Resume Uploaded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-md text-xs font-medium">
            <Clock className="w-3.5 h-3.5" /> Draft
          </span>
        );
    }
  };

  // Add this useEffect hook to detect user country
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        if (data.country_code === "US") {
          setUserCountry("US");
        } else if (data.country_code === "GB") {
          setUserCountry("GB");
        } else {
          setUserCountry("OTHER");
        }
      } catch (error) {
        console.log("Could not detect country, defaulting to OTHER");
        setUserCountry("OTHER");
      }
    };

    detectCountry();
  }, []);

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
          <div className="font-normal text-xl text-[#0B4F6C]">Digital Resume</div>
          <div className="w-10"></div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            {/* New Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-[#0B4F6C] tracking-tight">
                  Digital Resume Dashboard
                </h1>
                <p className="text-gray-500 mt-1 font-medium">Manage your professional presence in one place.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* <button
                  onClick={() => {
                    setAnalyticsId('');
                    setAnalyticsTitle('Overall Performance');
                    setAnalyticsOpen(true);
                  }}
                  className="flex items-center gap-2 bg-white border-2 border-[#0B4F6C] text-[#0B4F6C] px-4 py-2 rounded-xl font-normal hover:bg-[#0B4F6C] hover:text-white transition-all shadow-sm"
                >
                  <BarChart3 className="w-5 h-5" />
                  Analytics
                </button> */}
              </div>
            </div>

            {loading && careercasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-[#0B4F6C] h-12 w-12 mb-4" />
                <p className="text-gray-600 font-medium italic">Setting up your profile...</p>
              </div>
            ) : (
              <>
                {/* Status Cards Grid */}
                {(() => {
                  const latestWithResume = careercasts.find(c => c.resume_path);
                  const latestWithPortfolio = careercasts.find(c => c.vercel_portfolio_url);
                  const latestWithVideo = careercasts.find(c => c.recordings && c.recordings.length > 0);

                  // Final portfolio to show: record-specific first, then global fallback
                  const displayPortfolio = latestWithPortfolio?.vercel_portfolio_url || portfolioSettingsUrl;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {/* Card 1: Resume */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group flex items-center gap-4">
                        <div className="bg-blue-50 w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                          <FileText className="text-blue-600 w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-gray-400 font-normal text-xs uppercase tracking-wider mb-0.5">User Resume</h3>
                          {latestWithResume ? (
                            <button
                              onClick={() => viewDocumentSafe(latestWithResume.resume_path)}
                              className="text-[#0B4F6C] font-normal text-sm flex items-center gap-1.5 hover:underline truncate"
                            >
                              Latest Resume <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : (
                            <div className="flex flex-col">
                              <p className="text-red-500 font-medium text-[9px] italic leading-tight">latest resume not uploaded yet</p>
                              <button
                                onClick={handleNewCast}
                                className="text-[#159A9C] text-[8px] font-normal hover:underline text-left mt-0.5"
                              >
                                please upload your resume to record
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card 2: Portfolio */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group flex items-center gap-4">
                        <div className="bg-purple-50 w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                          <Link className="text-purple-600 w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-gray-400 font-normal text-xs uppercase tracking-wider mb-0.5">User Portfolio</h3>
                          <div className="flex flex-col gap-1.5">
                            {displayPortfolio && (
                              <a
                                href={displayPortfolio}
                                target="_blank"
                                rel="noreferrer"
                                className="text-purple-600 font-normal text-sm flex items-center gap-1.5 hover:underline truncate"
                              >
                                Latest Portfolio <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {!displayPortfolio && (
                              <div className="flex flex-col">
                                <p className="text-red-500 font-medium text-[9px] italic leading-tight">your portfolio has not been prepared yet</p>
                                <p className="text-orange-500 font-normal text-[8px] leading-tight truncate">
                                  it is in progress...
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Video Status */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group flex items-center gap-4">
                        <div className="bg-emerald-50 w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                          <Video className="text-emerald-600 w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-gray-400 font-normal text-xs uppercase tracking-wider mb-0.5">Video Status</h3>
                          {(() => {
                            const videoPath = latestWithVideo?.recordings?.[0]?.storage_path || latestOverallVideo;
                            if (videoPath) {
                              let video = videoPath.startsWith('http')
                                ? videoPath
                                : supabase.storage.from(isCRM ? 'CRM_users_recordings' : 'recordings').getPublicUrl(videoPath).data.publicUrl;

                              return (
                                <button
                                  onClick={() => setSelectedVideo(video)}
                                  className="text-emerald-600 font-normal text-sm flex items-center gap-1.5 hover:underline truncate"
                                >
                                  Latest Recorded <Play className="w-3 h-3 fill-emerald-600" />
                                </button>
                              );
                            }
                            return (
                              <button
                                onClick={() => {
                                  const latest = careercasts[0];
                                  if (latest) handleReRecord(latest);
                                  else handleNewCast();
                                }}
                                className="text-orange-600 font-normal text-[9px] hover:underline text-left leading-tight"
                              >
                                record your latest video status
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm mb-8">
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
                    {(() => {
                      const usedCount = careercasts.filter(c => c.recordings && c.recordings.length > 0).length;
                      const totalCerts = credits + usedCount;
                      const isOutOfCredits = totalCerts === usedCount;

                      return (
                        <>
                          <div className="flex flex-1 w-full flex-col sm:flex-row items-center justify-center lg:justify-start gap-8 sm:gap-12 lg:gap-16">
                            {/* Lifetime Credits */}
                            <div className="flex flex-col items-center lg:items-start group transition-all min-w-[120px]">
                              <span className="text-[10px] sm:text-xs text-gray-400 font-normal uppercase tracking-widest mb-1 group-hover:text-[#0B4F6C]">Lifetime Credits</span>
                              <span className="text-2xl sm:text-4xl font-black text-[#0B4F6C]">{totalCerts}</span>
                            </div>

                            {/* Divider (Desktop) */}
                            <div className="hidden sm:block w-px h-12 bg-gray-100"></div>

                            {/* Spent */}
                            <div className="flex flex-col items-center lg:items-start group transition-all min-w-[80px]">
                              <span className="text-[10px] sm:text-xs text-gray-400 font-normal uppercase tracking-widest mb-1 group-hover:text-orange-600">Spent</span>
                              <span className="text-2xl sm:text-4xl font-black text-orange-500">{usedCount}</span>
                            </div>

                            {/* Divider (Desktop) */}
                            <div className="hidden sm:block w-px h-12 bg-gray-100"></div>

                            {/* Balance */}
                            <div className="flex flex-col items-center lg:items-start group transition-all min-w-[100px]">
                              <span className="text-[10px] sm:text-xs text-gray-400 font-normal uppercase tracking-widest mb-1 group-hover:text-emerald-600">Balance</span>
                              <div className="flex items-center gap-4">
                                <span className="text-2xl sm:text-4xl font-black text-emerald-500">{credits}</span>
                                {isOutOfCredits && (
                                  <button
                                    onClick={() => navigate('/billing')}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#01796F] via-[#159A9C] to-[#01796F] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(21,154,156,0.3)] hover:shadow-[0_0_25px_rgba(21,154,156,0.5)] active:scale-95 transition-all animate-flow hover:scale-105 border border-white/20"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                    Get more credits
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="w-full lg:w-auto shrink-0">
                            <div className="relative group/btn">
                              <button
                                onClick={handleNewCast}
                                className="flex items-center justify-center gap-3 bg-gradient-to-r from-[#0B4F6C] to-[#159A9C] text-white px-8 py-4 sm:py-5 rounded-2xl font-normal transition-all shadow-lg active:scale-95 w-full lg:min-w-[280px] text-lg uppercase tracking-wider group-hover/btn:shadow-2xl group-hover/btn:-translate-y-0.5"
                              >
                                <Plus className="w-6 h-6 stroke-[3]" />
                                <span>New Digital Resume</span>
                              </button>

                              {/* Premium Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-72 p-4 bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-2xl opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-all duration-300 shadow-2xl z-50 text-center scale-90 group-hover/btn:scale-100">
                                <div className="font-normal mb-1.5 text-cyan-400 text-sm uppercase tracking-wider">Create New Resume</div>
                                <p className="text-gray-300 leading-relaxed font-medium">Build a professional profile by uploading your resume and recording a video introduction.</p>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900/95"></div>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Details Table Section */}
                {careercasts.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                      <h3 className="font-normal text-[#0B4F6C]">All Digital Resumes</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50/50 text-[#0B4F6C] uppercase tracking-wide font-normal text-xs hidden md:table-header-group">
                          <tr>
                            <th className="py-4 px-6 text-center w-16">S.No</th>
                            <th className="py-4 px-6 text-left w-48">Recordings</th>
                            <th className="py-4 px-6 text-left w-32">Resume</th>
                            <th className="py-4 px-6 text-left w-32">Video</th>
                            <th className="py-4 px-6 text-left w-40">Status</th>
                            <th className="py-4 px-6 text-left w-32">Created</th>
                            <th className="py-4 px-6 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {careercasts.map((cast, index) => {
                            const videoPath = cast.recordings?.[0]?.storage_path || null;
                            // Convert storage path to public URL if needed
                            let video = null;
                            if (videoPath) {
                              if (videoPath.startsWith('http')) {
                                video = videoPath;
                              } else {
                                // Determine bucket based on whether this is CRM user
                                const bucket = isCRM ? 'CRM_users_recordings' : 'recordings';
                                video = supabase.storage.from(bucket).getPublicUrl(videoPath).data.publicUrl;
                              }
                            }
                            const both = cast.resume_path && video;
                            return (
                              <React.Fragment key={cast.id}>
                                {/* Desktop view */}
                                <tr className="border-b hover:bg-gray-50/80 transition-colors hidden md:table-row">
                                  <td className="py-4 px-6 text-center font-normal text-gray-400">{careercasts.length - index}</td>
                                  <td className="py-4 px-6 text-left font-normal text-[#0B4F6C]">Recording-{careercasts.length - index}</td>
                                  <td className="py-4 px-6 text-left">
                                    {cast.resume_path ? (
                                      <div className="flex flex-col gap-1.5">
                                        <button
                                          onClick={() => viewDocumentSafe(cast.resume_path)}
                                          className="text-[#01796F] hover:text-[#016761] font-normal flex items-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                          <FileText className="w-4 h-4" /> View
                                        </button>
                                        {cast.vercel_portfolio_url && (
                                          <a
                                            href={cast.vercel_portfolio_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-blue-600 hover:text-blue-700 font-normal flex items-center gap-1.5 mt-0.5 text-xs transition-colors"
                                          >
                                            <Link className="w-3.5 h-3.5" /> Portfolio
                                          </a>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400 text-xs italic text-left font-medium">No resume</span>
                                    )}
                                  </td>
                                  <td className="py-4 px-6 text-left">
                                    {video ? (
                                      <button
                                        onClick={() => setSelectedVideo(video)}
                                        className="text-[#01796F] hover:text-[#016761] font-normal flex items-center gap-1.5 transition-colors"
                                      >
                                        <Play className="w-4 h-4 fill-current" /> Play
                                      </button>
                                    ) : (
                                      <span className="text-gray-400 text-xs italic text-left font-medium">No video</span>
                                    )}
                                  </td>
                                  <td className="py-4 px-6 text-left">{getBadge(cast.status)}</td>
                                  <td className="py-4 px-6 text-left font-normal text-gray-500 whitespace-nowrap">{formatDate(cast.created_at)}</td>
                                  <td className="py-4 px-6 text-center">
                                    <div className="flex justify-center gap-2">
                                      <button
                                        onClick={() => {
                                          if (!cast.resume_path) return;
                                          if (cast.is_api_resume) {
                                            // Navigate to FinalResult with profile email so it loads the same way
                                            const email = cast.owner_email || crmEmail || user?.email || '';
                                            navigate(`/final-result/profile?email=${encodeURIComponent(email)}`);
                                          } else {
                                            handleViewDetails(cast.id, cast.resume_path);
                                          }
                                        }}
                                        disabled={!cast.resume_path}
                                        className={`${cast.resume_path
                                          ? 'bg-[#01796F] hover:bg-[#016761] text-white'
                                          : 'bg-gray-200 text-gray-400'
                                          } px-3 py-1.5 rounded-md font-semibold text-xs transition-colors`}
                                      >
                                        View
                                      </button>
                                      {cast.resume_path && (
                                        <button
                                          onClick={() => handleReplaceClick(cast.id)}
                                          disabled={isReplacing && replacingId === cast.id}
                                          className="border-2 border-emerald-500 text-emerald-600 px-3 py-1.5 rounded-md font-semibold text-xs hover:bg-emerald-500 hover:text-white transition-colors flex items-center gap-1"
                                        >
                                          {isReplacing && replacingId === cast.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <FileUp className="w-3 h-3" />
                                          )}
                                          Replace
                                        </button>
                                      )}
                                      {both ? (
                                        <button
                                          onClick={() => handleReRecord(cast)}
                                          className="border-2 border-[#0B4F6C] text-[#0B4F6C] px-3 py-1.5 rounded-md font-semibold text-xs hover:bg-[#0B4F6C] hover:text-white transition-colors"
                                        >
                                          Re-record
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleReRecord(cast)}
                                          className="border-2 border-orange-500 text-orange-600 px-3 py-1.5 rounded-md font-semibold text-xs hover:bg-orange-500 hover:text-white transition-colors"
                                        >
                                          Continue
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {/* Mobile view */}
                                <tr key={`mobile-${cast.id}`} className="border-b border-gray-100 hover:bg-gray-50 md:hidden">
                                  <td className="py-6 px-4" colSpan={6}>
                                    <div className="flex flex-col gap-5">
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0">
                                          <h3 className="font-normal text-[#0B4F6C] text-lg leading-tight mb-1">Recording-{careercasts.length - index}</h3>
                                          <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatDate(cast.created_at)}
                                          </p>
                                        </div>
                                        <div className="flex-shrink-0">
                                          {getBadge(cast.status)}
                                        </div>
                                      </div>

                                      <div className="bg-gray-50/80 rounded-xl p-4 flex justify-around border border-gray-100">
                                        <div className="flex flex-col items-center gap-2">
                                          <span className="text-[10px] font-normal text-gray-400 uppercase tracking-widest">Resume</span>
                                          {cast.resume_path ? (
                                            <button
                                              onClick={() => viewDocumentSafe(cast.resume_path)}
                                              className="bg-emerald-50 text-emerald-700 p-2.5 rounded-full hover:bg-emerald-100 transition-colors"
                                            >
                                              <FileText className="w-5 h-5" />
                                            </button>
                                          ) : (
                                            <div className="bg-gray-100 text-gray-400 p-2.5 rounded-full cursor-not-allowed">
                                              <FileText className="w-5 h-5" />
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex flex-col items-center gap-2">
                                          <span className="text-[10px] font-normal text-gray-400 uppercase tracking-widest">Video</span>
                                          {video ? (
                                            <button
                                              onClick={() => setSelectedVideo(video)}
                                              className="bg-blue-50 text-blue-700 p-2.5 rounded-full hover:bg-blue-100 transition-colors"
                                            >
                                              <Play className="w-5 h-5 fill-current" />
                                            </button>
                                          ) : (
                                            <div className="bg-gray-100 text-gray-400 p-2.5 rounded-full cursor-not-allowed">
                                              <Play className="w-5 h-5" />
                                            </div>
                                          )}
                                        </div>

                                        {cast.vercel_portfolio_url && (
                                          <div className="flex flex-col items-center gap-2">
                                            <span className="text-[10px] font-normal text-gray-400 uppercase tracking-widest">Portfolio</span>
                                            <a
                                              href={cast.vercel_portfolio_url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="bg-purple-50 text-purple-700 p-2.5 rounded-full hover:bg-purple-100 transition-colors"
                                            >
                                              <Link className="w-5 h-5" />
                                            </a>
                                          </div>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-1 gap-3">
                                        <button
                                          onClick={() => {
                                            if (!cast.resume_path) return;
                                            if (cast.is_api_resume) {
                                              const email = cast.owner_email || crmEmail || user?.email || '';
                                              navigate(`/final-result/profile?email=${encodeURIComponent(email)}&resumeUrl=${encodeURIComponent(cast.resume_path || '')}`);
                                            } else {
                                              handleViewDetails(cast.id, cast.resume_path);
                                            }
                                          }}
                                          disabled={!cast.resume_path}
                                          className={`w-full ${cast.resume_path
                                            ? 'bg-[#0B4F6C] text-white shadow-md'
                                            : 'bg-gray-100 text-gray-400'
                                            } py-3.5 rounded-xl font-normal text-sm flex items-center justify-center gap-2 transform active:scale-95 transition-all`}
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                          View Details
                                        </button>

                                        <div className="flex gap-3">
                                          {cast.resume_path && (
                                            <button
                                              onClick={() => handleReplaceClick(cast.id)}
                                              disabled={isReplacing && replacingId === cast.id}
                                              className="flex-1 border-2 border-emerald-500 text-emerald-600 py-3 rounded-xl font-normal text-sm flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors"
                                            >
                                              {isReplacing && replacingId === cast.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                              ) : (
                                                <FileUp className="w-4 h-4" />
                                              )}
                                              Replace
                                            </button>
                                          )}

                                          {both ? (
                                            <button
                                              onClick={() => handleReRecord(cast)}
                                              className="flex-1 border-2 border-[#0B4F6C] text-[#0B4F6C] py-3 rounded-xl font-normal text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
                                            >
                                              <Redo className="w-4 h-4" />
                                              Re-record
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => handleReRecord(cast)}
                                              className="flex-1 border-2 border-orange-500 text-orange-600 py-3 rounded-xl font-normal text-sm flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors"
                                            >
                                              <Play className="w-4 h-4" />
                                              Continue
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* Upgrade popup */}
        {!isPremiumActive && showPricingPopup && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden mx-2 sm:mx-4">
              <div className="bg-gradient-to-r from-[#0B4F6C] to-[#159A9C] p-4 sm:p-5 flex justify-between items-center">
                <h3 className="text-white font-normal text-lg">Upgrade to Premium</h3>
                <button
                  onClick={handleClosePricingPopup}
                  className="text-white hover:text-gray-200 text-2xl font-normal p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 sm:p-6">
                <div className="text-center mb-4">
                  <Video className="mx-auto w-10 h-10 text-[#01796F]" />
                  <h4 className="font-normal text-lg mt-2">Get More Digital Resumes</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    You've used all your credits. Top up now to continue recording.
                  </p>
                </div>
                <div className="bg-[#01796F]/5 rounded-lg p-4 mb-5">
                  <ul className="text-sm text-gray-700 space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#01796F]" />
                      <span>Additional Digital Resumes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#01796F]" />
                      <span>HD Video Recording</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#01796F]" />
                      <span>Advanced Analytics</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#01796F]" />
                      <span>Priority Support</span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    handleClosePricingPopup();
                    navigate('/billing');
                  }}
                  className="w-full bg-[#01796F] text-white py-3 rounded-lg font-semibold hover:bg-[#016761] transition-colors"
                >
                  {userCountry === "GB" ? "Top Up Now - £9.99" : "Top Up Now - $9.99"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Player Modal */}
        {selectedVideo && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4 text-center">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-auto overflow-hidden">
              <div className="bg-gradient-to-r from-[#0B4F6C] to-[#159A9C] p-4 flex justify-between items-center">
                <h3 className="text-white font-normal text-lg flex items-center gap-2">
                  <Play className="w-5 h-5" fill="white" />
                  Video Preview
                </h3>
                <button
                  onClick={handleCloseVideo}
                  className="text-white hover:text-gray-200 text-2xl font-normal p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 bg-gray-50">
                <div className="bg-black rounded-lg overflow-hidden">
                  <video
                    controls
                    autoPlay
                    className="w-full h-auto"
                    style={{ maxHeight: '70vh' }}
                    src={selectedVideo}
                  >
                    <source src={selectedVideo} type="video/webm" />
                    <source src={selectedVideo} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Replace Resume Confirmation Modal */}
        {showReplaceModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden mx-2 sm:mx-4 animate-in fade-in zoom-in duration-200">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 flex justify-between items-center">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <FileUp className="w-6 h-6" />
                  Replace Resume
                </h3>
                <button
                  onClick={() => {
                    setShowReplaceModal(false);
                    setSelectedReplaceFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6">
                  <p className="text-emerald-800 text-sm font-medium leading-relaxed">
                    You are about to update the resume for:
                    <span className="block text-emerald-900 font-black text-lg mt-1">
                      Recording-{careercasts.length - careercasts.findIndex(c => c.id === replacingId)}
                    </span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <FileText className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 font-normal uppercase tracking-wider">New File Selected</p>
                      <p className="text-sm font-normal text-gray-700 truncate">{selectedReplaceFile?.name}</p>
                      <p className="text-[10px] text-gray-400">{(selectedReplaceFile?.size || 0) / 1024 > 1024
                        ? ((selectedReplaceFile?.size || 0) / (1024 * 1024)).toFixed(2) + ' MB'
                        : ((selectedReplaceFile?.size || 0) / 1024).toFixed(2) + ' KB'}</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 italic text-center">
                    Note: Replacing the resume will update the document recruiters see when viewing this digital resume.
                  </p>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowReplaceModal(false);
                        setSelectedReplaceFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-normal rounded-xl hover:bg-gray-50 transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmReplace}
                      disabled={isReplacing}
                      className="flex-1 px-4 py-3 bg-emerald-600 text-white font-normal rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                    >
                      {isReplacing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Confirm Upload
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hidden File Input for Resume Replace */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx"
          className="hidden"
        />

        {/* Analytics Slide-over Panel */}
        <AnalyticsPanel
          isOpen={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
          castId={analyticsId || ''}
          resumeTitle={analyticsTitle}
        />
      </div>
    </div>
  );
}
