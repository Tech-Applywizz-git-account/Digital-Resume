import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseResumeText, ParsedResumeData, extractLinkedin, extractGithub } from '../utils/parseResumeText';
import {
  PlayCircle, Mail, Video, Bot, Layers, Layout, BadgeCheck,
  History, MapPin, Download, Lightbulb, X, ArrowRight,
  ChevronDown, Sparkles, Briefcase, GraduationCap,
  Linkedin, Github, Menu, Loader2, AlertCircle, Search,
  Maximize2, Minimize2, Volume2, VolumeX, Pause, Play, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromBuffer } from '../utils/textExtraction';
import { extractPdfLinks } from '../utils/extractPdfLinks';
import { parseResumeWithGPT } from '../utils/aiHelpers';

const Scribble = ({ className }: { className?: string }) => (
  <motion.svg
    viewBox="0 0 100 20"
    className={`absolute pointer-events-none fill-none stroke-current opacity-40 ${className}`}
    initial={{ pathLength: 0, opacity: 0 }}
    animate={{ pathLength: 1, opacity: 0.4 }}
    transition={{ duration: 1.5, ease: "easeInOut" }}
  >
    <motion.path
      d="M5,15 Q25,5 45,15 T85,10"
      strokeWidth="2"
      strokeLinecap="round"
      animate={{ d: ["M5,15 Q25,5 45,15 T85,10", "M5,14 Q25,6 45,14 T85,11", "M5,15 Q25,5 45,15 T85,10"] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
  </motion.svg>
);

const CircleScribble = ({ className }: { className?: string }) => (
  <motion.svg
    viewBox="0 0 100 100"
    className={`absolute pointer-events-none fill-none stroke-current opacity-40 ${className}`}
    initial={{ rotate: 0, scale: 0.8, opacity: 0 }}
    animate={{ rotate: 360, scale: 1, opacity: 0.4 }}
    transition={{
      rotate: { duration: 20, repeat: Infinity, ease: "linear" },
      scale: { duration: 1, ease: "easeOut" },
      opacity: { duration: 1 }
    }}
  >
    <circle cx="50" cy="50" r="45" strokeWidth="1.5" strokeDasharray="5 5" />
  </motion.svg>
);

const Tape = ({ className = "" }: { className?: string }) => (
  <motion.div
    initial={{ scale: 0.9, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    whileHover={{ scale: 1.05, rotate: 2 }}
    className={`absolute h-6 w-16 bg-amber-200/40 backdrop-blur-[1px] border border-amber-300/20 shadow-sm z-10 ${className}`}
    style={{ clipPath: 'polygon(5% 0%, 95% 2%, 100% 50%, 98% 95%, 5% 100%, 0% 50%)' }} />
);

const getValidLink = (url?: string | null) => {
  if (!url) return null;
  return url.startsWith("http") ? url : `https://${url}`;
};

function cleanUrl(url: string | undefined | null, type: 'linkedin' | 'github'): string {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();

  // Remove brackets or unwanted chars
  clean = clean.replace(/[\[\]()]/g, '');
  // Add https if missing
  if (!clean.startsWith('http')) {
    clean = 'https://' + clean;
  }
  // Validate basic domain
  if (type === 'linkedin' && clean.includes('linkedin.com')) return clean;
  if (type === 'github' && clean.includes('github.com')) return clean;
  return '';
}

export default function ResumeIntroPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const emailParam = searchParams.get('email');
  const userIdParam = searchParams.get('userId');
  const resumeUrlParam = searchParams.get('resumeUrl');
  const jobTitleParam = searchParams.get('jobTitle') || searchParams.get('title') || searchParams.get('headline');
  const nameParam = searchParams.get('candidateName') || searchParams.get('name');

  const { user } = useAuth();

  // ── parsed data
  const [parsed, setParsed] = useState<ParsedResumeData | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [portfolioUrl, setPortfolioUrl] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isParsingResume, setIsParsingResume] = useState(false);

  const [isIntroVideoOpen, setIsIntroVideoOpen] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [isVideoMinimized, setIsVideoMinimized] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isHireMeModalOpen, setIsHireMeModalOpen] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isHumanMode, setIsHumanMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [expandedExp, setExpandedExp] = useState<Record<number, boolean>>({});


  const handleDownloadResume = () => {
    if (!resumeUrlParam) {
      alert("Resume file not available.");
      return;
    }

    // Use the proxy-pdf route to ensure reliable downloading (handles CORS)
    const downloadUrl = `/api/proxy-pdf?url=${encodeURIComponent(resumeUrlParam)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', 'Resume.pdf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // ─── Fetch user resume + video ──────────────────────────────────────────────
  useEffect(() => {
    if (!user && !emailParam && !userIdParam && !resumeUrlParam) {
      setDataLoading(false);
      return;
    }
    loadUserData();
  }, [user, emailParam, userIdParam, resumeUrlParam]);

  const loadUserData = async () => {
    setDataLoading(true);
    setDataError(null);

    try {
      const targetEmail = (emailParam || user?.email || null);
      const targetUserId = (userIdParam && userIdParam !== 'undefined') ? userIdParam : (user?.id || null);

      if (!targetEmail && !targetUserId) {
        setDataLoading(false);
        return;
      }

      // 1. Resolve CRM Data with robust filtering (avoiding "undefined" or "null" string errors)
      const orFilters: string[] = [];
      if (targetEmail && targetEmail !== 'null') {
        orFilters.push(`email.eq."${targetEmail}"`);
        orFilters.push(`company_application_email.eq."${targetEmail}"`);
      }
      if (targetUserId && targetUserId !== 'undefined' && targetUserId !== 'null') {
        orFilters.push(`user_id.eq."${targetUserId}"`);
      }

      let crmDataQuery = supabase.from('digital_resume_by_crm')
        .select('email, company_application_email, lead_name, user_id');
      
      if (orFilters.length > 0) {
        crmDataQuery = crmDataQuery.or(orFilters.join(','));
      } else {
        crmDataQuery = crmDataQuery.limit(0); 
      }

      const { data: crmData } = await crmDataQuery.limit(1).maybeSingle();

      const primaryEmail = crmData?.email || (targetEmail && targetEmail !== 'undefined' && targetEmail !== 'null' ? targetEmail : "");
      const resolvedUserId = crmData?.user_id || (targetUserId && targetUserId !== 'undefined' && targetUserId !== 'null' ? targetUserId : null);

      // PHASE 1: LOAD CRITICAL DATA INSTANTLY (VIDEO + BASIC PROFILES)
      const fetchVideoForUser = async (email: string | null, uId: string | null) => {
        const safeEmail = (email && email !== 'undefined' && email !== 'null') ? email : null;
        const safeUid = (uId && uId !== 'undefined' && uId !== 'null') ? uId : null;
        
        if (!safeEmail && !safeUid) return;
        console.log("🎞️ Attempting to fetch latest video for:", { safeEmail, safeUid });

        try {
          // 1. Try CRM recordings first (Latest)
          let crmRecQuery = supabase.from('crm_recordings').select('video_url, created_at');
          const crmFilters: string[] = [];
          if (safeEmail) crmFilters.push(`email.eq."${safeEmail}"`);
          if (safeUid) crmFilters.push(`user_id.eq."${safeUid}"`);

          if (crmFilters.length > 0) {
            crmRecQuery = crmRecQuery.or(crmFilters.join(','));
          } else {
            crmRecQuery = crmRecQuery.limit(0);
          }

          const { data: crmVideos, error: crmErr } = await crmRecQuery
            .order('created_at', { ascending: false })
            .limit(1);

          if (!crmErr && crmVideos && crmVideos.length > 0 && crmVideos[0].video_url) {
            const path = crmVideos[0].video_url;
            const url = path.startsWith('http')
              ? path
              : supabase.storage.from('CRM_users_recordings').getPublicUrl(path).data.publicUrl;
            
            console.log("🎞️ Found Latest CRM video:", url);
            setVideoUrl(url);
            return;
          }

          // 2. Fallback to Regular recordings
          let regRecQuery = supabase.from('recordings').select('storage_path, created_at');
          const regFilters: string[] = [];
          if (safeEmail) regFilters.push(`email.eq."${safeEmail}"`);
          if (safeUid) regFilters.push(`user_id.eq."${safeUid}"`);

          if (regFilters.length > 0) {
            regRecQuery = regRecQuery.or(regFilters.join(','));
          } else {
            regRecQuery = regRecQuery.limit(0);
          }

          const { data: regVideos, error: regErr } = await regRecQuery
            .order('created_at', { ascending: false })
            .limit(1);

          if (!regErr && regVideos && regVideos.length > 0 && regVideos[0].storage_path) {
            const path = regVideos[0].storage_path;
            const url = path.startsWith('http')
              ? path
              : supabase.storage.from('recordings').getPublicUrl(path).data.publicUrl;
            
            console.log("🎞️ Found Latest Regular video:", url);
            setVideoUrl(url);
          } else {
            console.log("🎞️ No recordings found for identifiers.");
          }
        } catch (err) {
          console.error("❌ Error fetching video:", err);
        }
      };

      await fetchVideoForUser(primaryEmail, resolvedUserId);

      // Fetch Portfolio Link from Applywizz Proxy if email exists
      if (primaryEmail) {
        try {
          const res = await fetch(`/api/proxy-applywizz?email=${primaryEmail}`);
          if (res.ok) {
            const vRaw = await res.json();
            const d = Array.isArray(vRaw) ? vRaw[0] : vRaw;
            const pUrl = d?.data?.portfolio?.link || d?.portfolio?.link || d?.link;
            // Check if it's a vercel app url as specified
            if (pUrl && pUrl.toLowerCase().includes('vercel.app')) {
              setPortfolioUrl(pUrl.startsWith('http') ? pUrl : `https://${pUrl}`);
            }
          }
        } catch (e) { console.warn("Portfolio fetch fail", e); }
      }

      // Resolve Basic Profile
      let profile: any = null;
      if (resolvedUserId && resolvedUserId !== 'null') {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('full_name, first_name, last_name')
            .eq('id', resolvedUserId)
            .maybeSingle();
          profile = data;
        } catch (_) {}
      }

      const resolvedNameRaw =
        crmData?.lead_name ||
        profile?.full_name ||
        (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : null) ||
        (targetEmail === user?.email ? user?.name : null) ||
        nameParam ||
        (targetEmail && targetEmail !== 'null' ? targetEmail.split('@')[0] : 'Professional');

      const cleanName = (name: string) => {
        if (!name || name === 'null') return 'Professional';
        let clean = name.replace(/Refilled/gi, '').replace(/[^a-zA-Z\s'-]/g, '').trim();
        clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
        return clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      };

      const finalName = cleanName(resolvedNameRaw);

      // SET INITIAL PARSED STATE FOR INSTANT DRAW WITH FALLBACKS
      setParsed({
        name: finalName || 'Professional',
        title: jobTitleParam || 'Software Engineer',
        email: primaryEmail,
        location: 'Remote',
        education: 'University Degree',
        yearsOfExperience: '5+ Years Experience',
        keyMetric: 'Driving Digital Innovation',
        scaleAndReach: 'Building scalable high-performance applications',
        summary: 'Experienced professional focused on delivering high-impact solutions and building efficient modern architectures.',
        skills: [{ category: 'Core Skills', items: ['Leadership', 'Problem Solving', 'Engineering'] }],
        experience: [],
        projects: [],
        certifications: [{ title: 'Verified Professional', issuer: 'Verified Institution' }],
        blogs: [
          { category: 'AI', tag: 'Innovation', title: 'The Future of AI Systems', description: 'Exploring the boundary of artificial intelligence...', date: 'Oct 12, 2023' },
          { category: 'Development', tag: 'Architecture', title: 'Scaling Modern Apps', description: 'Lessons learned from high-traffic environments...', date: 'Aug 24, 2023' }
        ],
        linkedin: '',
        github: '',
      });

      setDataLoading(false); // RENDER UI NOW 🚀

      // PHASE 2: BACKGROUND RESUME PROCESSING (CACHE + PARSING)
      setTimeout(async () => {
        try {
          if (!primaryEmail || primaryEmail === 'null' || primaryEmail === '') return;
          setIsParsingResume(true);
          console.log("⏳ Background Parsing Started for:", primaryEmail);

          // 1. Check Cache First (parsed_resumes table — skip silently if table missing)
          try {
            const { data: cached, error: cacheError } = await supabase
              .from('parsed_resumes')
              .select('parsed_json, resume_url')
              .eq('email', primaryEmail)
              .maybeSingle();

            if (!cacheError && cached?.parsed_json && cached.resume_url === resumeUrlParam) {
              console.log("🚀 Cache Hit! Using stored resume data.");
              setParsed(cached.parsed_json as ParsedResumeData);
              setIsParsingResume(false);
              return;
            }
            if (cached && !cacheError) {
              console.log("🔄 Resume URL changed — re-parsing.");
            }
          } catch (_) {
            // Table may not exist — silently continue to parse
          }

          // 2. PDF Extract -> GPT -> Parse
          // Route through proxy to avoid CORS errors with S3 URLs
          let extractedText = '';
          let extractedLinks = { linkedin: '', github: '' };
          if (resumeUrlParam) {
            try {
              const proxiedUrl = `/api/proxy-pdf?url=${encodeURIComponent(resumeUrlParam)}`;
              const response = await fetch(proxiedUrl);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const fileName = resumeUrlParam.split('?')[0].split('/').pop() || 'resume.pdf';
                [extractedText, extractedLinks] = await Promise.all([
                  extractTextFromBuffer(arrayBuffer.slice(0), fileName),
                  extractPdfLinks(arrayBuffer.slice(0)),
                ]);
              } else {
                console.warn('PDF proxy fetch failed:', response.status);
              }
            } catch (fetchErr) {
              console.warn('PDF fetch error (falling back to empty parse):', fetchErr);
            }
          }

          let parsedData: ParsedResumeData;
          if (extractedText && extractedText.length > 50) {
            const gptParsed = await parseResumeWithGPT(extractedText);
            if (gptParsed && typeof gptParsed === 'object') {
              parsedData = {
                ...gptParsed,
                linkedin: extractedLinks.linkedin || gptParsed.linkedin || '',
                github: extractedLinks.github || gptParsed.github || '',
                email: gptParsed.email || primaryEmail,
              };
            } else {
              parsedData = parseResumeText(extractedText, finalName, primaryEmail);
            }
          } else {
            parsedData = parseResumeText('', finalName, primaryEmail);
          }

          // 3. Store Cache (silently skip if table missing)
          try {
            await supabase.from('parsed_resumes').upsert({
              email: primaryEmail,
              resume_url: resumeUrlParam,
              parsed_json: parsedData,
            });
          } catch (_) { /* table may not exist */ }

          setParsed(parsedData);
          console.log("✅ Background Parsing Complete!");
        } catch (err) {
          console.error("Background loading error:", err);
        } finally {
          setIsParsingResume(false);
        }
      }, 0);

    } catch (err: any) {
      console.error('Error loading user data:', err);
      setDataError('Could not initial load user data.');
      setDataLoading(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setFormStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => { setIsContactModalOpen(false); setFormStatus('idle'); }, 2000);
      } else setFormStatus('error');
    } catch { setFormStatus('error'); }
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium">Loading your resume…</p>
        </div>
      </div>
    );
  }

  // Derive UI-ready values from parsed data
  const displayName = parsed?.name || '';
  const displayEmail = parsed?.email || '';
  const displayLocation = parsed?.location || '';
  const displayEducation = parsed?.education || '';
  const displayYears = parsed?.yearsOfExperience || '';
  const displayKeyMetric = parsed?.keyMetric || '';
  const displaySummary = parsed?.summary || '';
  const displayTitle = parsed?.title || '';
  const skillGroups = (parsed?.skills && parsed.skills.length > 0)
    ? parsed.skills
    : [{ category: 'Core Technologies', items: [] }];
  const expCards = (parsed?.experience && parsed.experience.length > 0)
    ? parsed.experience.map((e, i) => ({ ...e, active: i === 0 }))
    : [];
  const coreSkillChips = skillGroups.flatMap(g => g.items).slice(0, 6);

  const linkedinUrl = getValidLink(parsed?.linkedin);
  const githubUrl = getValidLink(parsed?.github);

  return (
    <div className={`min-h-screen transition-all duration-1000 ${isHumanMode ? 'bg-human-bg text-human-text font-sans bg-paper' : 'bg-[#f6f6f8] text-slate-900 font-sans'} selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden relative`}>
      {isHumanMode && (
        <>
          <div className="fixed inset-0 pointer-events-none z-[9998] opacity-[0.08] mix-blend-multiply" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
          <div className="fixed inset-0 pointer-events-none z-[9997] bg-human-primary/5 mix-blend-multiply"></div>
        </>
      )}


      {dataError && (
        <div className="fixed bottom-4 left-4 z-[200] flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-xl shadow-md text-xs">
          <AlertCircle size={14} /> {dataError}
        </div>
      )}

      {isParsingResume && (
        <div className="fixed bottom-4 right-4 z-[200] flex items-center gap-3 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-5 duration-500">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <span>Syncing resume details...</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md border-slate-200 shadow-sm py-2' : 'bg-white border-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 text-blue-600">
                <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-lg shadow-blue-200"><Layers size={20} /></div>
                <h2 className="text-[#0e121b] text-xl font-normal tracking-tighter">{displayName}<span className="text-blue-600">.</span></h2>
              </div>
              <nav className="hidden md:flex items-center gap-8">
                {portfolioUrl && (
                  <a
                    href={portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs font-normal uppercase tracking-widest transition-all ${isHumanMode ? 'text-amber-700/60 hover:text-amber-900 font-hand text-lg lowercase tracking-normal' : 'text-slate-400 hover:text-blue-600'}`}
                  >
                    Portfolio
                  </a>
                )}
                {(portfolioUrl && (linkedinUrl || githubUrl)) && <div className="h-4 w-px bg-slate-200 mx-2"></div>}
                {(linkedinUrl || githubUrl) && (
                  <div className="flex items-center gap-4">
                    {linkedinUrl && (
                      <a
                        href={linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Linkedin size={18} />
                      </a>
                    )}
                    {githubUrl && (
                      <motion.a
                        href={githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`relative flex items-center group px-3 py-1.5 rounded-full transition-all duration-300 overflow-hidden ${isHumanMode ? 'text-amber-700/60 hover:text-amber-900 border border-transparent hover:border-amber-200 hover:bg-amber-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        whileHover="hover"
                        initial="initial"
                      >
                        <motion.div
                          variants={{
                            initial: { x: 0 },
                            hover: { x: -3 }
                          }}
                          className="relative z-10 flex items-center"
                        >
                          <Github size={18} />
                        </motion.div>
                        <motion.span
                          variants={{
                            initial: { width: 0, opacity: 0, x: 10 },
                            hover: { width: 'auto', opacity: 1, x: 3 }
                          }}
                          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                          className="text-[10px] font-black uppercase tracking-widest overflow-hidden whitespace-nowrap relative z-10"
                        >
                          GitHub
                        </motion.span>
                        {/* Attraction Shimmer */}
                        <motion.div
                          animate={{
                            x: ['-100%', '200%'],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            repeatDelay: 5,
                            ease: "easeInOut"
                          }}
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent pointer-events-none z-0"
                        />
                      </motion.a>
                    )}
                  </div>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-4">

              <button
                onClick={() => setIsHumanMode(!isHumanMode)}
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-normal uppercase tracking-widest transition-all duration-700 ${isHumanMode ? 'bg-amber-100 text-amber-700 border border-amber-200 font-hand text-lg lowercase tracking-normal' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
                title={isHumanMode ? "Disable Human Mode" : "Enable Human Mode"}
              >
                <Sparkles size={12} className={isHumanMode ? 'animate-pulse' : ''} />
                {isHumanMode ? 'human mode on' : 'Human Mode'}
              </button>
              <button onClick={() => setIsContactModalOpen(true)} className={`hidden sm:block px-6 py-2 rounded-xl text-xs font-normal uppercase tracking-widest transition-all duration-700 shadow-xl ${isHumanMode ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200/40 font-hand text-2xl lowercase tracking-normal rotate-1 hover:scale-105' : 'bg-[#0e121b] text-white hover:bg-blue-600 shadow-slate-200'}`}>contact</button>
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"><Menu size={24} /></button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] md:hidden" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className={`fixed top-0 right-0 h-full w-[280px] z-[70] md:hidden shadow-2xl p-6 flex flex-col ${isHumanMode ? 'bg-[#fdfcf8]' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2"><Layers size={20} className="text-blue-600" /><span className="font-normal tracking-tighter text-slate-900">{displayName}.</span></div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <nav className="flex flex-col gap-2 flex-1">
                {portfolioUrl && (
                  <a
                    href={portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-3 p-4 rounded-2xl transition-all font-medium ${isHumanMode ? 'text-amber-900 hover:bg-amber-100/50 font-hand text-2xl lowercase' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'}`}>
                    Portfolio
                  </a>
                )}
              </nav>
              <div className="space-y-4 pt-6 border-t border-slate-100">
                <button
                  onClick={() => setIsHumanMode(!isHumanMode)}
                  className={`flex items-center gap-3 w-full p-4 rounded-2xl transition-all ${isHumanMode ? 'bg-amber-100 text-amber-900' : 'bg-slate-50 text-slate-900'}`}
                >
                  <Sparkles className={`w-5 h-5 ${isHumanMode ? 'fill-amber-500' : ''}`} />
                  <span className="font-medium">{isHumanMode ? 'Human Mode On' : 'Human Mode Off'}</span>
                </button>
                <button onClick={() => { setIsContactModalOpen(true); setIsSidebarOpen(false); }} className={`flex items-center gap-3 w-full p-4 rounded-2xl shadow-lg transition-all ${isHumanMode ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'}`}>
                  <Mail className="w-5 h-5" /><span>Contact Me</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content (8 cols) */}
          <div className="lg:col-span-8 space-y-8">

            {/* Hero */}
            <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`bg-white rounded-3xl p-8 shadow-sm border transition-all duration-700 relative overflow-hidden ${isHumanMode ? 'rotate-[-1.5deg] shadow-amber-200/60 border-amber-300 rounded-[3rem] animate-wobble' : 'border-slate-200'}`}>
              {isHumanMode && (
                <>
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="absolute top-6 right-8 z-10 pointer-events-none" >
                    <div className="font-hand text-amber-600 text-2xl -rotate-12 opacity-90 drop-shadow-sm"> Hand-crafted with care! </div>
                  </motion.div>
                  <Scribble className="top-1/4 -right-10 w-40 text-amber-600 rotate-12" />
                  <CircleScribble className="bottom-10 -left-10 w-32 text-amber-400" />
                </>
              )}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl -z-10"></div>
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="relative shrink-0">
                  {isHumanMode && <><Tape className="-top-3 left-1/2 -translate-x-1/2 rotate-12" /><Tape className="-bottom-3 left-1/2 -translate-x-1/2 -rotate-12" /></>}
                  <div className="relative group">
                    <div className={`h-32 w-32 md:h-40 md:w-40 overflow-hidden border-8 flex items-center justify-center transition-all duration-700 ${isHumanMode ? 'border-amber-100 shadow-human rotate-[-2deg] rounded-human-lg bg-amber-50 hover:rotate-1 hover:scale-105 hover:bg-amber-100' : 'border-slate-50 rounded-3xl shadow-2xl bg-slate-100'}`}>
                      <span className={`text-5xl font-black transition-all duration-700 ${isHumanMode ? 'text-human-primary font-hand text-7xl lowercase tracking-normal' : 'text-slate-400'}`}>{displayName.charAt(0)}</span>
                    </div>
                    {isHumanMode && (
                      <>
                        <Tape className="-top-4 -left-4 w-12 h-12 text-human-primary/20 -rotate-45" />
                        <Tape className="-bottom-4 -right-4 w-12 h-12 text-human-primary/20 -rotate-45" />
                        <div className="absolute -bottom-10 -left-4 rotate-[-15deg] whitespace-nowrap">
                          <p className="text-human-primary font-hand text-2xl bg-human-bg/90 px-3 py-1 rounded-human border border-human-primary/20 shadow-sm lowercase tracking-normal">hand-crafted with care!</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="absolute -bottom-3 -right-3 bg-white p-1.5 rounded-2xl shadow-lg border border-slate-100">
                    <div className="bg-green-500 h-4 w-4 rounded-full border-2 border-white"></div>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <h1 className={`text-3xl md:text-4xl font-normal tracking-tight transition-all duration-700 ${isHumanMode ? 'text-human-text font-hand text-8xl lowercase tracking-normal' : 'text-[#0e121b]'}`}>{displayName}</h1>
                        {isHumanMode && <Scribble className="-bottom-5 left-0 w-full text-human-secondary/40" />}
                      </div>
                      <div className="flex gap-3">
                        <span className={`px-4 py-1 rounded-human text-[10px] font-normal uppercase tracking-widest transition-all duration-700 ${isHumanMode ? 'bg-human-primary text-white rotate-2 font-hand text-2xl lowercase tracking-normal' : 'bg-blue-600 text-white'}`}>verified!</span>
                        {displayLocation && <span className={`px-4 py-1 rounded-human bg-slate-100 text-slate-500 text-[10px] font-normal uppercase tracking-widest transition-all duration-700 ${isHumanMode ? 'bg-human-bg -rotate-2 border border-human-primary/20 font-hand text-2xl lowercase tracking-normal shadow-sm' : ''}`}><MapPin size={10} className="inline mr-1" />{displayLocation}</span>}
                      </div>
                    </div>
                    <p className={`text-xl font-semibold tracking-tight transition-all duration-700 ${isHumanMode ? 'text-amber-700 font-hand text-4xl lowercase tracking-normal' : 'text-blue-600'}`}>{displayTitle}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-slate-100">
                    {isParsingResume && !displayLocation && !displayEducation && !displayYears && !displayKeyMetric ? (
                      <>
                        {[1, 2, 3].map(i => (
                          <div key={i} className="space-y-2 animate-pulse">
                            <div className="h-2 w-12 bg-slate-100 rounded" />
                            <div className="h-4 w-24 bg-slate-100 rounded" />
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        {displayEducation && <div className="space-y-1"><p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Education</p><p className={`text-sm font-normal ${isHumanMode ? 'text-stone-800 font-hand text-lg' : 'text-[#0e121b]'}`}>{displayEducation}</p></div>}
                        {displayYears && <div className="space-y-1"><p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Experience</p><p className={`text-sm font-normal ${isHumanMode ? 'text-stone-800 font-hand text-lg' : 'text-[#0e121b]'}`}>{displayYears}</p></div>}
                        {displayKeyMetric && <div className="space-y-1"><p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Key Metric</p><p className={`text-sm font-normal ${isHumanMode ? 'text-amber-600 font-hand text-lg' : 'text-green-600'}`}>{displayKeyMetric}</p></div>}
                      </>
                    )}
                  </div>
                  {/* Summary removed for clean hero layout */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.05, rotate: isHumanMode ? 2 : 0 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (videoUrl) {
                          setIsIntroVideoOpen(true);
                          setIsVideoPlaying(true);
                        } else {
                          alert("A personalized video intro is not yet available for this profile. Please contact the candidate directly for more details.");
                          console.warn("No video available for:", displayEmail);
                        }
                      }}
                      className={`flex items-center gap-2 px-10 py-3 rounded-human font-normal text-xs uppercase tracking-widest transition-all duration-700 shadow-xl group hover:scale-105 active:scale-95 ${isHumanMode ? 'bg-human-primary text-white shadow-human hover:bg-human-primary/90 rotate-1 font-hand text-3xl lowercase tracking-normal' : 'bg-[#0e121b] text-white shadow-slate-200 hover:bg-blue-600'}`}
                    >
                      <PlayCircle size={18} className="group-hover:scale-110 transition-transform" />
                      watch intro
                    </motion.button>
                    <button onClick={() => setIsContactModalOpen(true)} className={`flex items-center gap-2 bg-white border px-10 py-3 rounded-human font-normal text-xs uppercase tracking-widest transition-all duration-700 shadow-sm hover:scale-105 active:scale-95 ${isHumanMode ? 'border-human-primary/40 text-human-text hover:bg-human-bg -rotate-1 border-dashed font-hand text-3xl lowercase tracking-normal shadow-human' : 'border-slate-200 text-[#0e121b] hover:bg-slate-50'}`}>
                      <Mail size={18} />contact
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Technical Arsenal (Skills) */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-normal flex items-center gap-2 transition-all duration-700 relative ${isHumanMode ? 'text-stone-800 font-hand text-4xl lowercase tracking-normal' : 'text-[#0e121b]'}`}>
                  <Bot size={20} className={isHumanMode ? 'text-amber-600 animate-pulse' : 'text-blue-600'} />
                  Technical Arsenal
                  {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
                </h3>
                <span className={`text-[10px] font-normal uppercase tracking-widest ${isHumanMode ? 'text-amber-600/60' : 'text-slate-400'}`}>Production Ready</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isParsingResume && (
                  <>
                    <div className="h-32 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                    <div className="h-32 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                  </>
                )}
                {skillGroups.map((group, idx) => (
                  <div key={group.category} className={`bg-white p-6 rounded-2xl border transition-all group relative ${isHumanMode ? (idx % 2 === 0 ? 'rotate-[1.5deg] border-amber-200 shadow-amber-50 rounded-[2rem] sketchy-border' : 'rotate-[-1.5deg] border-amber-200 shadow-amber-50 rounded-[2rem] sketchy-border') : 'border-slate-200 shadow-sm hover:shadow-md'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg transition-all ${isHumanMode ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}><Layers size={16} /></div>
                      <h5 className={`text-xs font-normal uppercase tracking-wider ${isHumanMode ? 'text-stone-700 font-hand text-xl' : 'text-[#0e121b]'}`}>{group.category}</h5>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.items.length > 0 ? group.items.map((skill, sIdx) => (
                        <span key={skill} className={`px-3 py-1.5 text-[11px] font-normal rounded-lg border transition-all cursor-default ${isHumanMode ? `bg-amber-50/30 text-stone-600 border-amber-200 hover:border-amber-500 hover:bg-amber-100 font-hand text-sm lowercase tracking-normal ${sIdx % 2 === 0 ? 'rotate-[1deg]' : '-rotate-[1deg]'}` : 'bg-slate-50 text-slate-600 border-slate-100 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'}`}>{skill}</span>
                      )) : <span className="text-xs text-slate-400 italic">Skills will appear here</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Career Trajectory (Experience) */}
            <section className="space-y-8">
              <h3 className={`text-lg font-normal flex items-center gap-2 transition-all duration-700 relative ${isHumanMode ? 'text-stone-800 font-hand text-3xl' : 'text-[#0e121b]'}`}>
                <History size={20} className={isHumanMode ? 'text-amber-600' : 'text-blue-600'} />
                Career Trajectory
                {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
              </h3>
              <div className="space-y-6">
                {isParsingResume && (
                  <div className="animate-pulse space-y-4">
                    <div className="h-24 bg-slate-100 rounded-3xl" />
                    <div className="h-24 bg-slate-100 rounded-3xl" />
                  </div>
                )}
                {(parsed?.experience && parsed.experience.length > 0) ? (
                  parsed.experience.map((job, i) => {
                    const isExpanded = expandedExp[i];
                    const isCurrentRole = (job.duration && job.duration.toLowerCase().includes('present')) || job.active;
                    return (
                      <div key={i} className={`group relative bg-white p-6 rounded-3xl border transition-all duration-500 ${isHumanMode ? 'bg-white border-human-primary/10 shadow-human rotate-[1.2deg] rounded-human-lg' : 'bg-white border-slate-200 shadow-sm hover:shadow-xl rounded-3xl'}`}>
                        {isHumanMode && <CircleScribble className="-top-4 -right-4 w-12 h-12 text-amber-200" />}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-4">
                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${isCurrentRole ? (isHumanMode ? 'bg-human-primary text-white shadow-human rotate-3 scale-110' : 'bg-blue-600 text-white shadow-lg shadow-blue-200') : 'bg-slate-100 text-slate-400'}`}>
                              <Briefcase size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h4 className={`font-normal transition-all duration-700 ${isHumanMode ? 'text-human-text font-hand text-4xl lowercase tracking-normal' : 'text-[#0e121b] group-hover:text-blue-600'}`}>{job.role}</h4>
                                {job.active && (
                                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-normal uppercase tracking-wider border ${isHumanMode ? 'bg-human-primary text-white border-human-primary/20 rotate-3 font-hand text-2xl lowercase tracking-normal shadow-human' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                    <div className={`h-1 w-1 rounded-full animate-pulse ${isHumanMode ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className={`text-sm font-normal uppercase tracking-widest transition-all duration-700 ${isHumanMode ? 'text-human-primary/80 font-hand text-2xl lowercase tracking-normal' : 'text-slate-400'}`}>{job.company}</p>
                            </div>
                          </div>
                          <div className={`px-5 py-2 rounded-human border text-[10px] font-normal uppercase tracking-widest h-fit transition-all duration-700 ${isHumanMode ? 'bg-human-bg border-human-primary/20 text-human-primary -rotate-2 font-hand text-3xl lowercase tracking-normal shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                            {job.duration}
                          </div>
                        </div>

                        <p className={`text-sm leading-relaxed pl-16 transition-all duration-700 ${!isExpanded ? 'line-clamp-2' : ''} ${isHumanMode ? 'text-human-text font-hand text-2xl lowercase tracking-normal' : 'text-slate-500'}`}>
                          {job.description}
                        </p>

                        {!isExpanded ? (
                          <div className="mt-6 pl-16 flex items-center gap-4">
                            <button onClick={() => setExpandedExp(prev => ({ ...prev, [i]: true }))} className={`font-normal flex items-center gap-1 hover:underline transition-all duration-700 ${isHumanMode ? 'text-amber-600 font-hand text-2xl lowercase tracking-normal' : 'text-[10px] uppercase tracking-widest text-blue-600'}`}>
                              view more <ChevronDown size={14} />
                            </button>
                            {job.active && (
                              <>
                                <span className="h-1 w-1 bg-slate-200 rounded-full"></span>
                                <span className={`text-[10px] font-normal uppercase tracking-widest flex items-center gap-1.5 transition-colors ${isHumanMode ? 'text-emerald-600 font-hand text-lg lowercase tracking-normal' : 'text-emerald-600'}`}>
                                  <div className="h-1.5 w-1.5 rounded-full animate-pulse bg-emerald-500"></div>
                                  Current Role
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          <>
                            {job.achievements && job.achievements.length > 0 && (
                              <div className="mt-4 pl-16 space-y-2">
                                {job.achievements.slice(0, 6).map((achievement: string, aIdx: number) => (
                                  <div key={aIdx} className="flex gap-2 items-start">
                                    <div className={`mt-1.5 shrink-0 h-1 w-1 rounded-full ${isHumanMode ? 'bg-amber-400' : 'bg-blue-600'}`}></div>
                                    <p className={`text-[11px] leading-relaxed ${isHumanMode ? 'text-stone-600' : 'text-slate-500'}`}>{achievement}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-6 pl-16 flex items-center gap-4">
                              <button onClick={() => setExpandedExp(prev => ({ ...prev, [i]: false }))} className={`font-normal flex items-center gap-1 hover:underline transition-all duration-700 ${isHumanMode ? 'text-amber-600 font-hand text-2xl lowercase tracking-normal' : 'text-[10px] uppercase tracking-widest text-blue-600'}`}>
                                view less <ChevronDown size={14} className="rotate-180" />
                              </button>
                              {job.active && (
                                <>
                                  <span className="h-1 w-1 bg-slate-200 rounded-full"></span>
                                  <span className={`text-[10px] font-normal uppercase tracking-widest flex items-center gap-1.5 transition-colors ${isHumanMode ? 'text-emerald-600 font-hand text-lg lowercase tracking-normal' : 'text-emerald-600'}`}>
                                    <div className="h-1.5 w-1.5 rounded-full animate-pulse bg-emerald-500"></div>
                                    Current Role
                                  </span>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })
                ) : (

                  <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400">
                    <Briefcase size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Experience details will appear here</p>
                  </div>
                )}
              </div>
            </section>


            {/* Key Highlights */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-8 rounded-[2.5rem] shadow-xl transition-all duration-500 group relative overflow-hidden ${isHumanMode ? 'bg-amber-600 text-white shadow-amber-200 rotate-[-1deg] rounded-[2.5rem]' : 'bg-[#0e121b] text-white shadow-slate-200'}`}>
                {isHumanMode && <Scribble className="top-0 left-0 w-full text-amber-400/30" />}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${isHumanMode ? 'bg-white/20' : 'bg-blue-600 shadow-lg shadow-blue-500/40'}`}>
                  <Sparkles size={24} className="text-white" />
                </div>
                <h4 className={`text-[10px] font-normal uppercase tracking-widest mb-2 ${isHumanMode ? 'text-amber-100' : 'text-blue-400'}`}>Primary Impact</h4>
                <p className={`text-xl font-normal leading-tight tracking-tight ${isHumanMode ? 'font-hand text-2xl underline underline-offset-8 decoration-amber-300' : ''}`}>{parsed?.keyMetric}</p>
              </div>
              <div className={`p-8 rounded-[2.5rem] transition-all duration-500 group relative overflow-hidden border ${isHumanMode ? 'bg-white border-amber-300 shadow-amber-100 rotate-[1deg] rounded-[2.5rem]' : 'bg-white border-slate-200 hover:border-blue-200 shadow-sm'}`}>
                {isHumanMode && <CircleScribble className="-bottom-10 -right-10 w-32 text-amber-100" />}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-all ${isHumanMode ? 'bg-amber-100 rotate-[-6deg]' : 'bg-[#0e121b] rounded-xl shadow-lg shadow-slate-200'}`}>
                  <Bot size={24} className={`${isHumanMode ? 'text-amber-600' : 'text-white'}`} />
                </div>
                <h4 className={`text-[10px] font-normal uppercase tracking-widest mb-2 ${isHumanMode ? 'text-amber-600/60' : 'text-slate-400'}`}>Scale & Reach</h4>
                <p className={`text-xl font-normal leading-tight tracking-tight ${isHumanMode ? 'text-stone-800 font-hand text-3xl' : 'text-[#0e121b]'}`}>{parsed?.scaleAndReach}</p>
              </div>
            </section>


            {/* Project Explorer */}
            <section className="space-y-8">
              <h3 className={`text-lg font-normal flex items-center gap-2 transition-all duration-700 relative ${isHumanMode ? 'text-stone-800 font-hand text-3xl' : 'text-[#0e121b]'}`}>
                <Layers size={20} className={isHumanMode ? 'text-amber-600' : 'text-blue-600'} />
                Interactive Project Explorer
                {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
              </h3>
              <div className="space-y-6">
                {isParsingResume && (
                  <div className="animate-pulse space-y-6">
                    <div className="h-64 bg-slate-50 rounded-[3rem]" />
                  </div>
                )}
                {(parsed?.projects && parsed.projects.length > 0) ? (
                  <div className="space-y-6">
                    {parsed.projects.map((project, i) => (
                      <div key={i} className={`bg-white rounded-2xl border overflow-hidden transition-all duration-500 relative ${isHumanMode ? 'border-amber-300 shadow-amber-100 rotate-[-1.5deg] rounded-[3rem] border-dashed' : 'border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1'}`}>
                        {isHumanMode && (
                          <>
                            <Tape className="-top-2 left-10 rotate-[-12deg]" />
                            <Tape className="-top-2 right-10 rotate-[12deg]" />
                            <Scribble className="top-0 left-0 w-full text-amber-200/50" />
                          </>
                        )}
                        <div className={`border-b p-6 transition-colors ${isHumanMode ? 'border-amber-200' : 'border-slate-100'}`}>
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <h4 className={`text-xl font-normal transition-colors ${isHumanMode ? 'text-stone-800 font-hand text-3xl' : 'text-[#0e121b]'}`}>{project.title}</h4>
                              <p className={`text-sm mt-1 transition-colors ${isHumanMode ? 'text-stone-500 font-hand text-lg' : 'text-slate-500'}`}>{project.description}</p>
                            </div>
                            <span className={`px-3 py-1 text-xs font-normal rounded-full border transition-all ${project.status === 'Active'
                              ? (isHumanMode ? 'bg-amber-600 text-white border-amber-500 rotate-3' : 'bg-green-50 text-green-600 border-green-100')
                              : (isHumanMode ? 'bg-stone-100 text-stone-600 border-stone-200 -rotate-3' : 'bg-blue-50 text-blue-600 border-blue-100')
                              }`}>
                              {project.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                              <h5 className={`text-[10px] font-normal uppercase tracking-widest mb-3 transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-lg' : 'text-slate-400'}`}>Problem</h5>
                              <p className={`text-sm leading-relaxed transition-colors ${isHumanMode ? 'text-stone-600 font-hand text-lg' : 'text-slate-600'}`}>{project.problem}</p>
                            </div>
                            <div>
                              <h5 className={`text-[10px] font-normal uppercase tracking-widest mb-3 transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-lg' : 'text-slate-400'}`}>Impact</h5>
                              <p className={`text-sm leading-relaxed transition-colors ${isHumanMode ? 'text-stone-600 font-hand text-lg' : 'text-slate-600'}`}>{project.impact}</p>
                            </div>
                          </div>
                        </div>
                        <div className={`p-6 transition-colors ${isHumanMode ? 'bg-amber-50/40' : 'bg-slate-50'}`}>
                          <h5 className={`text-[10px] font-normal uppercase tracking-widest mb-4 transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-lg' : 'text-slate-400'}`}>Tech Stack & Architecture</h5>
                          <div className="flex flex-wrap gap-2">
                            {(project.techStack || []).map((tech, idx) => (
                              <span
                                key={tech}
                                className={`px-3 py-1.5 border text-xs font-medium rounded-lg transition-all ${isHumanMode
                                  ? `bg-white border-amber-300 text-stone-700 shadow-sm font-hand text-sm lowercase tracking-normal ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}`
                                  : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                          <div className="mt-8 flex justify-end items-center">
                            <button className={`border px-4 py-2 rounded-lg text-xs font-normal transition-all shadow-sm flex items-center gap-2 group ${isHumanMode
                              ? 'bg-amber-600 border-amber-500 text-white hover:bg-amber-700 font-hand text-lg'
                              : 'bg-white border-slate-200 text-[#0e121b] hover:bg-slate-50'
                              }`}>
                              View Project
                              <PlayCircle size={14} className={`transition-transform group-hover:scale-110 ${isHumanMode ? 'text-white' : 'text-blue-600'}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400">
                    <Layout size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Key projects will appear here</p>
                  </div>
                )}
              </div>
            </section>


            {/* Technical Blog */}
            <section className="space-y-8">
              <h3 className={`text-lg font-normal flex items-center gap-2 transition-all duration-700 relative ${isHumanMode ? 'text-stone-800 font-hand text-3xl' : 'text-[#0e121b]'}`}>
                <Layout size={20} className={isHumanMode ? 'text-amber-600' : 'text-blue-600'} />
                Technical Blog
                {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(parsed?.blogs || []).map((blog, i) => (
                  <div key={i} className={`group bg-white p-6 rounded-[2rem] border transition-all duration-500 ${isHumanMode ? 'border-amber-200 shadow-amber-50 rotate-[0.8deg]' : 'border-slate-200 hover:border-blue-200 shadow-sm hover:shadow-xl'}`}>
                    <div className="flex gap-2 mb-6">
                      <span className={`px-2 py-1 rounded-md text-[8px] font-normal uppercase tracking-widest ${isHumanMode ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-[#0e121b]'}`}>
                        {blog.category}
                      </span>
                      <span className={`px-2 py-1 rounded-md text-[8px] font-normal uppercase tracking-widest ${isHumanMode ? 'bg-stone-100 text-stone-500' : 'bg-emerald-50 text-emerald-600'}`}>
                        {blog.tag}
                      </span>
                    </div>
                    <h4 className={`text-sm font-normal mb-3 tracking-tight leading-tight group-hover:text-blue-600 transition-colors ${isHumanMode ? 'text-stone-800 font-hand text-xl' : 'text-[#0e121b]'}`}>
                      {blog.title}
                    </h4>
                    <p className={`text-[10px] leading-relaxed mb-6 ${isHumanMode ? 'text-stone-500' : 'text-slate-500'}`}>
                      {blog.description}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <span className="text-[9px] font-normal text-slate-400 tracking-widest uppercase">{blog.date}</span>
                      <button className={`p-1.5 rounded-lg transition-all ${isHumanMode ? 'hover:bg-amber-100 text-amber-600' : 'hover:bg-slate-100 text-blue-600'}`}>
                        <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Certifications Section */}
            <section className="space-y-6">
              <h3 className={`text-lg font-normal flex items-center gap-2 transition-all duration-700 relative ${isHumanMode ? 'text-stone-800 font-hand text-3xl' : 'text-[#0e121b]'}`}>
                <BadgeCheck size={20} className={isHumanMode ? 'text-amber-600' : 'text-blue-600'} />
                Certifications
                {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
              </h3>
              {parsed?.certifications && parsed.certifications.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {parsed.certifications.map((cert, i) => (
                    <div key={i} className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${isHumanMode ? 'bg-white border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className={`p-2.5 rounded-xl ${isHumanMode ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}><BadgeCheck size={18} /></div>
                      <div>
                        <p className={`text-xs font-normal ${isHumanMode ? 'text-stone-800 font-hand text-lg' : 'text-[#0e121b]'}`}>{cert.title}</p>
                        <p className={`text-[10px] uppercase tracking-widest ${isHumanMode ? 'text-amber-700/60' : 'text-slate-500'}`}>{cert.issuer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400">
                  <BadgeCheck size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Certifications will appear here</p>
                </div>
              )}
            </section>




          </div>

          {/* Sticky Sidebar (4 cols) */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 pb-8 space-y-6">
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`rounded-2xl border transition-all duration-700 overflow-hidden relative ${isHumanMode ? 'bg-white border-amber-300 shadow-amber-200/50 rotate-[1deg] rounded-[3rem]' : 'bg-white border-slate-200 shadow-xl'}`}>
                {isHumanMode && <Scribble className="top-10 -left-10 w-40 text-amber-200 -rotate-90" />}
                <div className={`p-6 text-white transition-colors ${isHumanMode ? 'bg-amber-600' : 'bg-[#0e121b]'}`}>
                  <h3 className={`font-normal flex items-center gap-2 text-sm uppercase tracking-widest ${isHumanMode ? 'font-hand text-2xl' : ''}`}>
                    <Search size={18} className={isHumanMode ? 'text-amber-200' : 'text-blue-400'} />At A Glance
                  </h3>
                </div>

                {/* Portfolio Info */}

                <div className="p-8 space-y-8 relative">
                  <div className="space-y-6">
                    {displayTitle && (
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-xl transition-colors ${isHumanMode ? 'bg-amber-100 text-amber-600 rotate-3' : 'bg-slate-50 text-slate-400'}`}><BadgeCheck size={18} /></div>
                        <div><p className={`text-[10px] font-normal uppercase tracking-widest mb-1 transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-sm' : 'text-slate-400'}`}>Current Role</p><p className={`text-sm font-normal transition-colors ${isHumanMode ? 'text-stone-800 font-hand text-lg' : 'text-[#0e121b]'}`}>{displayTitle}</p></div>
                      </div>
                    )}
                    {displayEducation && (
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-xl transition-colors ${isHumanMode ? 'bg-amber-100 text-amber-600 -rotate-3' : 'bg-slate-50 text-slate-400'}`}><GraduationCap size={18} /></div>
                        <div><p className={`text-[10px] font-normal uppercase tracking-widest mb-1 transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-sm' : 'text-slate-400'}`}>Education</p><p className={`text-sm font-normal transition-colors ${isHumanMode ? 'text-stone-800 font-hand text-lg' : 'text-[#0e121b]'}`}>{displayEducation}</p></div>
                      </div>
                    )}
                    {displayLocation && (
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-xl transition-colors ${isHumanMode ? 'bg-amber-100 text-amber-600 rotate-6' : 'bg-slate-50 text-slate-400'}`}><MapPin size={18} /></div>
                        <div><p className={`text-[10px] font-normal uppercase tracking-widest mb-1 transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-sm' : 'text-slate-400'}`}>Location</p><p className={`text-sm font-normal transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-lg' : 'text-blue-600'}`}>{displayLocation}</p></div>
                      </div>
                    )}
                  </div>
                  {coreSkillChips.length > 0 && (
                    <>
                      <div className={`h-px ${isHumanMode ? 'bg-amber-200' : 'bg-slate-100'}`}></div>
                      <div className="space-y-4">
                        <p className={`text-[10px] font-normal uppercase tracking-widest transition-colors ${isHumanMode ? 'text-amber-700 font-hand text-sm' : 'text-slate-400'}`}>Core Competencies</p>
                        <div className="flex flex-wrap gap-2">
                          {coreSkillChips.map((skill, idx) => (
                            <span key={skill} className={`px-3 py-1.5 text-[10px] font-normal rounded-lg tracking-wider transition-all ${isHumanMode ? `bg-amber-600 text-white shadow-sm font-hand text-sm lowercase tracking-normal ${idx % 2 === 0 ? 'rotate-[2deg]' : '-rotate-[2deg]'}` : 'bg-[#0e121b] text-white'}`}>{skill}</span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="space-y-4 pt-4">
                    <button onClick={handleDownloadResume} className={`w-full py-4 rounded-2xl font-normal text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl ${isHumanMode ? 'bg-amber-600 text-white shadow-amber-100 hover:bg-amber-700 font-hand text-lg lowercase tracking-normal' : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'}`}>
                      <Download size={18} />Download Resume
                    </button>
                    <button onClick={() => setIsContactModalOpen(true)} className={`w-full border-2 py-4 rounded-2xl font-normal text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isHumanMode ? 'bg-white border-amber-100 text-stone-800 hover:bg-amber-50 font-hand text-lg lowercase tracking-normal' : 'bg-white border-slate-100 text-[#0e121b] hover:bg-slate-50'}`}>
                      <Mail size={18} />Contact
                    </button>
                  </div>
                </div>
              </motion.div>

              {displaySummary && (
                <div className={`mt-6 p-5 border rounded-2xl transition-all duration-700 ${isHumanMode ? 'bg-amber-100/50 border-amber-200 rotate-[-1deg]' : 'bg-amber-50 border-amber-100'}`}>
                  <div className="flex items-center gap-2 mb-3 text-amber-700">
                    <Lightbulb size={18} />
                    <h4 className={`text-[10px] font-normal uppercase tracking-widest transition-all duration-700 ${isHumanMode ? 'font-hand text-2xl lowercase tracking-normal' : ''}`}>candidate insight</h4>
                  </div>
                  <p className={`text-xs leading-relaxed transition-all duration-700 ${isHumanMode ? 'text-stone-800 font-hand text-xl lowercase tracking-normal' : 'text-amber-800/80'}`}>{displaySummary}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Intro Video Mini-Player (Movable YouTube Style) */}
      <AnimatePresence>
        {isIntroVideoOpen && videoUrl && (
          <motion.div
            drag
            dragElastic={0.05}
            dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
            dragConstraints={{
              left: -window.innerWidth + (isVideoExpanded ? (window.innerWidth < 640 ? window.innerWidth * 0.9 : 600) : (isVideoMinimized ? 64 : (window.innerWidth < 640 ? 280 : 320))) + 24,
              right: 24,
              top: -window.innerHeight + (isVideoExpanded ? 400 : (isVideoMinimized ? 64 : 200)) + 48,
              bottom: 24
            }}
            initial={{ opacity: 0, scale: 0.9, y: 0, x: 0 }}
            animate={isVideoExpanded ? {
              opacity: 1,
              scale: 1,
              x: -window.innerWidth / 2 + (window.innerWidth < 640 ? 160 : 190),
              y: -window.innerHeight / 2 + 150,
              width: window.innerWidth < 640 ? '90vw' : '600px',
              height: 'auto',
              zIndex: 200
            } : isVideoMinimized ? {
              opacity: 1,
              scale: 1,
              y: 0,
              x: 0,
              width: '64px',
              height: '64px',
              zIndex: 150
            } : {
              opacity: 1,
              scale: 1,
              y: 0,
              x: 0,
              width: window.innerWidth < 640 ? '280px' : '320px',
              height: 'auto',
              zIndex: 150
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            whileDrag={{ scale: 1.02, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className={`fixed bottom-24 right-6 bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col cursor-move select-none ${isVideoMinimized ? 'rounded-full' : ''}`}
          >
            {isVideoMinimized ? (
              <button
                onClick={() => setIsVideoMinimized(false)}
                className="w-full h-full flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                title="Expand Video"
              >
                <Video size={24} />
              </button>
            ) : (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setShowControls(!showControls)}
                onMouseEnter={() => setShowControls(true)}
                onMouseLeave={() => setShowControls(false)}
                className="relative aspect-video bg-slate-900 group cursor-default"
              >
                {isHumanMode && (
                  <>
                    <Tape className="-top-3 left-1/4 -translate-x-1/2 rotate-12" />
                    <Tape className="-bottom-3 right-1/4 translate-x-1/2 -rotate-12" />
                  </>
                )}
                {/* Floating Minimal Controls (Top Right) */}
                <div className={`absolute top-3 right-3 flex items-center gap-2 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsVideoMinimized(true); }}
                    className="p-1.5 bg-black/40 backdrop-blur-md hover:bg-black/60 rounded-lg transition-colors text-white border border-white/10"
                    title="Minimize to Bubble"
                  >
                    <Minimize2 size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsVideoExpanded(!isVideoExpanded); }}
                    className="p-1.5 bg-black/40 backdrop-blur-md hover:bg-black/60 rounded-lg transition-colors text-white border border-white/10"
                    title={isVideoExpanded ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isVideoExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsIntroVideoOpen(false); setIsVideoExpanded(false); setIsVideoMinimized(false); }}
                    className="p-1.5 bg-black/40 backdrop-blur-md hover:bg-black/60 rounded-lg transition-colors text-white border border-white/10"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Video */}
                <video
                  key={videoUrl}
                  src={videoUrl}
                  autoPlay={isVideoPlaying}
                  muted={isVideoMuted}
                  playsInline
                  className="w-full h-full object-contain bg-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVideoPlaying(!isVideoPlaying);
                  }}
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                />

                {/* Enhanced Video Controls Overlay */}
                <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 flex flex-col justify-between p-4 z-10 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                  {/* Top Info */}
                  <div className="flex justify-between items-start">
                    <div className={`bg-black/20 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-white/80 tracking-wider uppercase ${isHumanMode ? 'font-hand text-sm lowercase text-amber-200' : ''}`}>
                      Intro Pitch
                    </div>
                  </div>

                  {/* Center Play/Pause (Large for Mobile/Tablet) */}
                  <div className="flex items-center justify-center pointer-events-auto">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsVideoPlaying(!isVideoPlaying); }}
                      className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-all transform hover:scale-110 shadow-2xl"
                    >
                      {isVideoPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                    </button>
                  </div>

                  {/* Bottom Bar (YouTube Style) */}
                  <div className="space-y-3 pointer-events-auto">
                    {/* Progress Bar (Simulated) */}
                    <div className="relative h-1 w-full bg-white/20 rounded-full overflow-hidden group/progress cursor-pointer">
                      <div className={`absolute top-0 left-0 h-full transition-all duration-300 ${isHumanMode ? 'bg-amber-500' : 'bg-blue-500'} ${isVideoPlaying ? 'w-1/2' : 'w-1/3'}`}></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); setIsVideoPlaying(!isVideoPlaying); }}
                          className="text-white hover:text-blue-400 transition-colors"
                        >
                          {isVideoPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setIsVideoMuted(!isVideoMuted); }}
                          className="text-white hover:text-blue-400 transition-colors"
                        >
                          {isVideoMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        <span className={`text-[10px] font-mono text-white/60 ${isHumanMode ? 'font-hand text-sm text-amber-200/60' : ''}`}>0:45 / 1:30</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="text-white hover:text-blue-400 transition-colors"
                        >
                          <Settings size={18} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setIsVideoExpanded(!isVideoExpanded); }}
                          className="text-white hover:text-blue-400 transition-colors"
                        >
                          {isVideoExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Static Play Icon (Hidden when controls are visible) */}
                {!isVideoPlaying && !showControls && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-12 w-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                      <PlayCircle size={24} className="text-white fill-white/10" />
                    </div>
                  </div>
                )}

                <div className={`absolute bottom-3 left-3 right-3 text-white transition-opacity duration-300 ${showControls ? 'opacity-0' : 'opacity-80'}`}>
                  <p className="font-bold text-[10px] leading-tight">{displayName} — Intro Pitch</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hire Me Modal */}
      <AnimatePresence>
        {isHireMeModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHireMeModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className={`p-6 text-white flex justify-between items-center ${isHumanMode ? 'bg-amber-600' : 'bg-[#0e121b]'}`}>
                <div>
                  <h3 className="text-xl font-normal">{displayName}</h3>
                  <p className="text-sm opacity-70">{displayTitle}</p>
                </div>
                <button onClick={() => setIsHireMeModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full text-white"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-4">
                <p className="text-sm text-slate-500">Download the full resume directly or contact to request more details.</p>
                <div className="space-y-3">
                  <button onClick={handleDownloadResume} className="w-full py-4 rounded-2xl font-normal text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all">
                    <Download size={18} />Download Resume
                  </button>
                  <button onClick={() => { setIsHireMeModalOpen(false); setIsContactModalOpen(true); }} className="w-full py-4 rounded-2xl font-normal text-sm border-2 border-slate-100 text-[#0e121b] hover:bg-slate-50 flex items-center justify-center gap-2 transition-all">
                    <Mail size={18} />Contact via Email
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Contact Modal */}
      <AnimatePresence>
        {isContactModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsContactModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className={`relative w-full max-w-lg overflow-hidden ${isHumanMode ? 'bg-[#fdf9f0] rounded-[3rem] border-2 border-amber-200 shadow-xl' : 'bg-white rounded-3xl shadow-2xl'}`}>
              <div className={`p-6 flex justify-between items-center ${isHumanMode ? 'bg-amber-100 text-amber-900' : 'bg-blue-600 text-white'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isHumanMode ? 'bg-amber-200 text-amber-700' : 'bg-white/20'}`}><Mail size={24} /></div>
                  <div>
                    <h3 className={`text-xl font-normal transition-all duration-700 ${isHumanMode ? 'font-hand text-3xl lowercase tracking-normal text-stone-800' : ''}`}>contact {displayName.toLowerCase()}</h3>
                    <div className="flex flex-col">
                      <p className={`text-xs font-medium uppercase tracking-widest mt-0.5 transition-all duration-700 ${isHumanMode ? 'text-amber-700/60 font-hand text-lg lowercase tracking-normal' : 'text-blue-100'}`}>direct message</p>
                      {displayEmail && <p className={`text-[10px] font-normal mt-1 opacity-80 transition-all duration-700 ${isHumanMode ? 'text-amber-900/60 font-hand text-lg lowercase tracking-normal' : 'text-white/70'}`}>{displayEmail}</p>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsContactModalOpen(false)} className={`rounded-full p-2 transition-colors ${isHumanMode ? 'hover:bg-amber-200 text-amber-700' : 'hover:bg-white/20 text-white'}`}><X size={20} /></button>
              </div>
              <div className="p-12 text-center space-y-8">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto transition-all duration-500 shadow-xl ${isHumanMode ? 'bg-amber-100 text-amber-600 rotate-3 shadow-amber-100' : 'bg-blue-50 text-blue-600 shadow-blue-100'}`}>
                  <Mail size={32} />
                </div>

                <div className="space-y-3">
                  <h4 className={`text-[10px] font-normal uppercase tracking-[0.2em] ${isHumanMode ? 'text-amber-700/60' : 'text-slate-400'}`}>Official Contact Point</h4>
                  <div className="relative group cursor-pointer inline-block" onClick={() => { navigator.clipboard.writeText(displayEmail); alert('Email copied!'); }}>
                    <p className={`text-2xl md:text-3xl font-black tracking-tighter break-all transition-all ${isHumanMode ? 'text-stone-800 font-hand hover:text-amber-600' : 'text-[#0e121b] hover:text-blue-600'}`}>
                      {displayEmail}
                    </p>
                    <div className={`h-1 w-full mt-1 rounded-full transition-all ${isHumanMode ? 'bg-amber-200 group-hover:bg-amber-600' : 'bg-slate-100 group-hover:bg-blue-600'}`}></div>
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-normal uppercase tracking-widest text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Click to copy</span>
                  </div>
                </div>

                <div className="pt-8">
                  <a href={`mailto:${displayEmail}`} className={`inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-normal text-xs uppercase tracking-widest transition-all shadow-xl group ${isHumanMode ? 'bg-amber-600 text-white shadow-amber-200 hover:bg-amber-700' : 'bg-[#0e121b] text-white shadow-slate-200 hover:bg-blue-600'}`}>
                    Open in Mail App <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t mt-12 transition-all duration-700 ${isHumanMode ? 'border-amber-100' : 'border-slate-200'}`}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className={`flex items-center gap-2 ${isHumanMode ? 'text-amber-700/60' : 'text-slate-400'}`}>
            <Layers size={16} />
            <p className={`text-xs font-medium transition-all duration-700 ${isHumanMode ? 'font-hand text-xl lowercase tracking-normal' : ''}`}>© {new Date().getFullYear()} {displayName.toLowerCase()} — handcrafted with ❤️</p>
          </div>
          <div className="flex gap-8">
            {['Privacy Policy', 'Terms of Service', 'Support'].map(item => (
              <a key={item} href="#" className={`text-xs font-medium transition-colors ${isHumanMode ? 'text-amber-700 hover:text-amber-900' : 'text-slate-500 hover:text-blue-600'}`}>{item}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
