import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Mail, Layers, BadgeCheck,
    MapPin, Lightbulb, User,
    Linkedin, Menu, Loader2, AlertCircle,
    Sparkles, GraduationCap, X, Share2, Download, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../integrations/supabase/client';
import { useAuth } from '../../../contexts/AuthContext';
import { VideoPlayer } from '../components/VideoPlayer';
import { ResumeModals } from '../components/ResumeModals';
import { ShareModal } from '../components/ShareModal';
import { Scribble } from '../components/CommonElements';
import { HeroSection } from '../components/HeroSection';
import { SkillsSection } from '../components/ResumeSections';
import type { CareerIdentityProfileResponse } from '../../../types/careerIdentity';
import { trackEvent, trackSessionEnd } from '../../../utils/tracking';

const getValidLink = (url?: string | null) => {
    if (!url) return undefined;
    return url.startsWith("http") ? url : `https://${url}`;
};

const CareerIdentityPage: React.FC = () => {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const emailParam = searchParams.get('email');
    const userIdParam = searchParams.get('userId');
    const resumeUrlParam = searchParams.get('resumeUrl');
    const jobTitleParam = searchParams.get('jobTitle') || searchParams.get('title') || searchParams.get('headline');
    const canChangeAvatarParam = searchParams.get('canChangeAvatar') === 'true';
    const candidateNameParam = searchParams.get('candidateName') || searchParams.get('name');
    const castIdParam = searchParams.get('castId') || location.pathname.split('/').pop() || null;
    const videoUrlParam = searchParams.get('videoUrl');
    const autoPlayVideoParam = searchParams.get('autoPlayVideo') === 'true';
    const sourceParam = (searchParams.get('source') === 'pdf' ? 'pdf' : 'website');
    const openContactParam = searchParams.get('openContact') === 'true';

    const { user } = useAuth();

    const isPreviewMode = searchParams.get('preview') === 'true';
    const previewContent = isPreviewMode
        ? localStorage.getItem('ci_preview_content')
        : null;
    const previewTheme = isPreviewMode
        ? localStorage.getItem('ci_preview_theme')
        : null;
    const previewAvatar = isPreviewMode
        ? localStorage.getItem('ci_preview_avatar')
        : null;
    const previewVideoUrl = isPreviewMode
        ? localStorage.getItem('ci_preview_video_url')
        : null;
    const previewResumeUrl = isPreviewMode
        ? localStorage.getItem('ci_preview_resume_url')
        : null;

    const [profile, setProfile] = useState<CareerIdentityProfileResponse | null>(
        previewContent ? {
            tier: 'career_identity',
            profile: {
                id: 'preview',
                resumeId: castIdParam || 'preview',
                userId: null,
                themeId: previewTheme || 'aurora',
                status: 'draft',
                content: JSON.parse(previewContent),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            derived: {
                candidateName: JSON.parse(previewContent).hero?.fullName || null,
                email: JSON.parse(previewContent).contact?.email || null,
                jobTitle: JSON.parse(previewContent).hero?.headline || null,
                resumeUrl: previewResumeUrl,
                videoUrl: previewVideoUrl,
                portfolioUrl: null,
            },
        } as CareerIdentityProfileResponse : null
    );
    const [dataLoading, setDataLoading] = useState(!previewContent);
    const [dataError, setDataError] = useState<string | null>(null);

    // Primary source: career_identity_data content (what admin edits)
    // Fallback: derived data (from profiles/job_requests tables)
    const displayName = profile?.profile?.content?.hero?.fullName || profile?.derived?.candidateName || candidateNameParam || 'Professional';
    const displayTitle = profile?.profile?.content?.hero?.headline || jobTitleParam || profile?.derived?.jobTitle || '';
    const displayEmail = emailParam || profile?.derived?.email || '';
    const displayLocation = profile?.profile?.content?.contact?.location || '';
    const displayEducation = (profile?.profile?.content?.education || []).map((e: any) => e.degree).filter(Boolean).join(', ');
    const displayOpenToRelocate = profile?.profile?.content?.hero?.openToRelocate || false;
    const videoUrl = videoUrlParam || profile?.derived?.videoUrl || null;
    const portfolioUrl = profile?.derived?.portfolioUrl || null;
    const resumeUrl = resumeUrlParam || profile?.derived?.resumeUrl || null;
    const shareUrl = `${window.location.origin}${location.pathname}${location.search}`;

    const content = profile?.profile?.content;
    const skillGroups = content?.skills?.length
        ? [{ category: 'Skills', items: content.skills.map((s: any) => s.name) }]
        : [{ category: 'Skills', items: [] }];

    const displaySummary = content?.about || '';
    const linkedinUrl = profile?.profile?.content?.contact?.linkedin ? getValidLink(profile.profile.content.contact.linkedin) : undefined;

    const [isIntroVideoOpen, setIsIntroVideoOpen] = useState(false);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isVideoExpanded, setIsVideoExpanded] = useState(false);
    const [isVideoMinimized, setIsVideoMinimized] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isHireMeModalOpen, setIsHireMeModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isDownloadingResume, setIsDownloadingResume] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isHumanMode, setIsHumanMode] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [scheduleStep, setScheduleStep] = useState<1 | 2 | 3>(1);
    const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', date: '', time: '', subject: '', message: '', jobUrl: '' });

    const [videoCurrentTime, setVideoCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);
    const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
    const [candidatePhone] = useState<string | null>(null);
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [hasClickedIntroOnce, setHasClickedIntroOnce] = useState(false);
    const [walletPassUrl, setWalletPassUrl] = useState<string | null>(null);
    const [showWalletUnavailable, setShowWalletUnavailable] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (isPreviewMode) return;

        const loadData = async () => {
            setDataLoading(true);
            try {
                const castId = castIdParam;
                if (!castId) { setDataLoading(false); return; }

                // Load from Express backend public endpoint (same backend that handles publishing)
                const response = await fetch(`/api/v1/career-identity/profile/public/${encodeURIComponent(castId)}`);
                if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    throw new Error(body?.error?.message || body?.message || `Failed to load Career Identity profile (${response.status})`);
                }
                const body = await response.json();
                if (body?.data) {
                    setProfile(body.data);
                }
            } catch (err: any) {
                console.error('[CareerIdentityPage] Failed to load data:', err);
                setDataError(err.message || 'Failed to load data');
            } finally { setDataLoading(false); }
        };
        loadData();
        const currentId = castIdParam || "profile";
        trackEvent('page_load', currentId, { source: sourceParam });
        if (openContactParam) setTimeout(() => setIsContactModalOpen(true), 800);
        return () => trackSessionEnd(currentId);
    }, [castIdParam, openContactParam, isPreviewMode]);

    // Sync avatar from profile data (published) or localStorage (preview)
    useEffect(() => {
        if (isPreviewMode) {
            setSelectedAvatar(previewAvatar || null);
        } else if (profile?.profile?.content?.hero?.profileImageUrl) {
            setSelectedAvatar(profile.profile.content.hero.profileImageUrl);
        }
    }, [profile, isPreviewMode, previewAvatar]);

    // Extract wallet pass URL from profile data
    useEffect(() => {
        if (profile?.profile) {
            const profileData = profile.profile as unknown as Record<string, unknown>;
            if (profileData.walletPassUrl) {
                setWalletPassUrl(profileData.walletPassUrl as string);
            }
        }
    }, [profile]);

    useEffect(() => {
        if (videoUrl && !isIntroVideoOpen && !hasAutoPlayed) {
            const timer = setTimeout(() => {
                setIsIntroVideoOpen(true);
                // Do NOT autoplay — show the floating player with Play button
                // User must click Play or Watch Intro to start
                setHasAutoPlayed(true);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [videoUrl]);

    useEffect(() => {
        if (autoPlayVideoParam && videoUrl && !isIntroVideoOpen && !hasAutoPlayed) {
            const timer = setTimeout(() => {
                setIsIntroVideoOpen(true); setIsVideoPlaying(true);
                setAutoplayBlocked(false); setHasAutoPlayed(true);
                trackEvent('play_intro', castIdParam || "profile", { source: sourceParam, mode: 'autoplay' });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoPlayVideoParam, videoUrl, isIntroVideoOpen, hasAutoPlayed]);

    useEffect(() => {
        if (isIntroVideoOpen && isVideoPlaying && videoRef.current) {
            const vid = videoRef.current;
            vid.muted = true;
            vid.play().then(() => {
                setTimeout(() => { if (videoRef.current) { videoRef.current.muted = false; setIsVideoMuted(false); } }, 300);
            }).catch(() => { setIsVideoPlaying(false); setAutoplayBlocked(true); });
        }
    }, [isIntroVideoOpen, isVideoPlaying]);

    const handlePlayIntroWithAvatarCheck = () => {
        trackEvent('play_intro', castIdParam || "profile", { source: sourceParam });
        if (!selectedAvatar && !hasClickedIntroOnce) {
            setIsAvatarModalOpen(true); setHasClickedIntroOnce(true);
            if (castIdParam) sessionStorage.setItem(`intro_clicked_${castIdParam}`, 'true');
        } else { setIsIntroVideoOpen(true); }
    };

    const handleAvatarSelect = (avatarPath: string) => {
        setSelectedAvatar(avatarPath);
        if (castIdParam) localStorage.setItem(`avatar_${castIdParam}`, avatarPath);
        setIsAvatarModalOpen(false);
    };

    const handleDownloadResume = () => {
        if (!resumeUrl) return;
        const link = document.createElement('a');
        link.href = resumeUrl; link.setAttribute('download', `${displayName}_resume.pdf`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        trackEvent('pdf_download', castIdParam || "profile", { source: sourceParam });
    };

    const handleDownloadDigitalResume = () => {
        if (!castIdParam || !resumeUrl) return;
        setIsDownloadingResume(true);
        window.open(`/final-result/${castIdParam}?autoDownload=true&resumeUrl=${encodeURIComponent(resumeUrl)}&candidateName=${encodeURIComponent(displayName)}&email=${encodeURIComponent(displayEmail)}&source=pdf`, '_blank');
        trackEvent('pdf_download', castIdParam, { source: sourceParam });
        setIsDownloadingResume(false);
    };

    const handleEmailCandidate = () => {
        trackEvent('play_intro', castIdParam || "profile", { source: sourceParam });
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${displayEmail}&su=${encodeURIComponent("Regarding Interview")}&body=${encodeURIComponent("Hi, I would like to connect regarding your profile.")}`, "_blank");
        setIsContactModalOpen(false);
    };

    const handleWhatsAppCandidate = () => {
        if (!candidatePhone) return;
        trackEvent('play_intro', castIdParam || "profile", { source: sourceParam });
        window.open(`https://wa.me/${candidatePhone}?text=${encodeURIComponent("Hi, I would like to connect regarding your interview.")}`, "_blank");
        setIsContactModalOpen(false);
    };

    const handleScheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormStatus('submitting');
        if (!formData.jobUrl || formData.jobUrl.trim() === '') {
            setStatusMessage({ type: 'error', text: 'Meeting link is required' });
            setTimeout(() => setStatusMessage(null), 3000); setFormStatus('idle'); return;
        }
        try {
            const meetingTime = `${formData.date}T${formData.time}`;
            const { error } = await supabase.from('scheduled_calls').insert({
                candidate_email: displayEmail, candidate_name: displayName, hr_email: formData.email,
                meeting_time: meetingTime, meeting_link: formData.jobUrl,
            });
            if (error) throw error;
            await supabase.from('notifications').insert({
                user_email: displayEmail, is_read: false,
                message: `New interview scheduled with HR (${formData.email}) for ${new Date(formData.date).toLocaleDateString()}.`
            });
            trackEvent('play_intro', castIdParam || "profile", { source: sourceParam });
            setFormStatus('success');
            setTimeout(() => { setIsScheduleModalOpen(false); setFormStatus('idle'); setFormData({ name: '', email: '', date: '', time: '', subject: '', message: '', jobUrl: '' }); setScheduleStep(1); }, 3000);
        } catch { setFormStatus('error'); }
    };

    const getDynamicIcon = () => <BadgeCheck size={20} />;

    return (
        <div className={`min-h-screen transition-all duration-1000 ${isHumanMode ? 'bg-amber-50/30' : 'bg-[#f6f6f8]'} ${isHumanMode ? 'selection:bg-amber-100 selection:text-amber-900' : 'selection:bg-blue-100 selection:text-blue-900'} overflow-x-clip`}>
            {dataError && (
                <div className="fixed bottom-4 left-4 z-[200] flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-xl shadow-md text-xs">
                    <AlertCircle size={14} /> {dataError}
                </div>
            )}

            {/* Header */}
            <header className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md border-slate-200 shadow-sm' : 'bg-white border-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 md:h-20">
                        <div className="flex items-center gap-4 md:gap-8">
                            <div className={`flex items-center gap-2 transition-all duration-700 ${isHumanMode ? 'text-orange-600' : 'text-amber-600'}`}>
                                <div className={`p-1.5 rounded-lg text-white shadow-lg ${isHumanMode ? 'bg-orange-600 shadow-orange-200/40' : 'bg-blue-600 shadow-blue-200'}`}><Layers size={20} /></div>
                                <h2 className={`text-[#0e121b] text-lg md:text-xl font-normal tracking-tighter ${isHumanMode ? 'font-hand text-xl md:text-2xl' : ''}`}>{displayName}<span className={isHumanMode ? 'text-orange-600' : 'text-amber-600'}>.</span></h2>
                            </div>
                            <nav className="hidden sm:flex items-center gap-3">
                                {linkedinUrl && (
                                    <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                                        className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl border transition-all ${isHumanMode ? 'bg-amber-100/30 border-amber-200/50 text-amber-800 hover:bg-amber-100' : 'bg-slate-50 border-slate-100 text-[#0e121b] hover:bg-blue-600 hover:text-white hover:border-blue-600'}`}>
                                        <Linkedin size={16} />
                                    </a>
                                )}
                                {portfolioUrl && (
                                    <a href={getValidLink(portfolioUrl)} target="_blank" rel="noopener noreferrer"
                                        onClick={() => trackEvent('portfolio_click', castIdParam || "profile", { source: sourceParam })}
                                        className={`flex items-center gap-2 h-9 md:h-10 px-3 md:px-4 rounded-xl border text-xs font-medium transition-all ${isHumanMode ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100' : 'bg-slate-50 border-slate-100 text-[#0e121b] hover:bg-blue-600 hover:text-white hover:border-blue-600'}`}>
                                        Portfolio
                                    </a>
                                )}
                            </nav>
                        </div>
                        <div className="flex items-center gap-2 md:gap-4">
                            <button onClick={() => setIsHumanMode(!isHumanMode)}
                                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-normal uppercase tracking-widest ${isHumanMode ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}>
                                <Sparkles size={12} /> Creative
                            </button>
                            <button onClick={() => setIsShareModalOpen(true)}
                                className={`hidden sm:inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs font-normal uppercase tracking-widest transition-all ${isHumanMode ? 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-50 font-hand text-base tracking-normal' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}>
                                <Share2 size={14} /> Share
                            </button>
                            <button onClick={handleDownloadDigitalResume} disabled={isDownloadingResume}
                                className={`hidden sm:inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs font-normal uppercase tracking-widest transition-all ${isHumanMode ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 font-hand text-base tracking-normal border border-orange-300' : 'bg-[#0B4F6C]/10 text-[#0B4F6C] hover:bg-[#0B4F6C]/20 border border-[#0B4F6C]/20'}`}>
                                {isDownloadingResume ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Resume
                            </button>
                            <button onClick={() => setIsContactModalOpen(true)}
                                className={`px-5 md:px-6 py-2 rounded-xl text-xs font-normal uppercase tracking-widest shadow-lg ${isHumanMode ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-200/40' : 'bg-[#0e121b] text-white hover:bg-blue-600 shadow-slate-200'}`}>Contact</button>
                            <button onClick={() => setIsSidebarOpen(true)} className="sm:hidden p-2 text-slate-600"><Menu size={24} /></button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]" />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 right-0 h-full w-[280px] z-[70] bg-white shadow-2xl p-6 flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2">
                                    <Layers size={20} className="text-orange-600" />
                                    <span className="font-normal tracking-tighter text-slate-900">{displayName}<span className="text-orange-600">.</span></span>
                                </div>
                                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
                            </div>
                            <div className="space-y-4 pt-6 border-t border-slate-100">
                                <button onClick={() => setIsHumanMode(!isHumanMode)}
                                    className={`flex items-center gap-3 w-full p-4 rounded-2xl ${isHumanMode ? 'bg-amber-100 text-amber-900' : 'bg-slate-50 text-slate-900'}`}>
                                    <Sparkles className={`w-5 h-5 ${isHumanMode ? 'fill-amber-500' : ''}`} /> Creative Mode
                                </button>
                                <button onClick={() => { setIsContactModalOpen(true); setIsSidebarOpen(false); }}
                                    className="flex items-center gap-3 w-full p-4 rounded-2xl shadow-lg bg-slate-900 text-white hover:bg-slate-800">
                                    <Mail className="w-5 h-5" /> Contact Me
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 lg:py-12">
                <div className="flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-12">
                    <div className="w-full lg:flex-1 space-y-6 md:space-y-8 min-w-0">
                        <HeroSection
                            dataLoading={dataLoading}
                            parsed={profile?.profile?.content}
                            isHumanMode={isHumanMode}
                            displayName={displayName}
                            displayTitle={displayTitle}
                            displayEducation={displayEducation || ''}
                            displayYears=""
                            displayKeyMetric=""
                            displayOpenToRelocate={displayOpenToRelocate}
                            videoUrl={videoUrl}
                            selectedAvatar={selectedAvatar}
                            onAvatarClick={canChangeAvatarParam ? () => setIsAvatarModalOpen(true) : () => { }}
                            canChangeAvatar={canChangeAvatarParam}
                            setIsIntroVideoOpen={handlePlayIntroWithAvatarCheck}
                            setIsContactModalOpen={() => { setIsContactModalOpen(true); trackEvent('lets_talk', castIdParam || "profile", { source: sourceParam, type: 'hero_contact' }); }}
                        />

                        {displaySummary && (
                            <div className={`p-6 md:p-8 rounded-[2rem] border transition-all ${isHumanMode ? 'bg-white border-amber-200 shadow-amber-50' : 'bg-white border-slate-200 shadow-sm'}`}>
                                <h3 className={`text-lg font-bold flex items-center gap-2 mb-4 ${isHumanMode ? 'text-stone-800 font-hand text-2xl tracking-normal' : 'text-[#0e121b]'}`}>
                                    <Lightbulb size={20} className={isHumanMode ? 'text-amber-600' : 'text-blue-600'} />
                                    About Me
                                    {isHumanMode && <Scribble className="-bottom-2 left-0 w-full text-amber-500/40" />}
                                </h3>
                                <p className={`text-sm md:text-base leading-relaxed ${isHumanMode ? 'text-stone-700 font-hand text-lg tracking-normal' : 'text-slate-700'}`}>{displaySummary}</p>
                            </div>
                        )}

                        <SkillsSection
                            isHumanMode={isHumanMode}
                            dataLoading={dataLoading}
                            parsed={profile?.profile?.content}
                            skillGroups={skillGroups}
                            getDynamicIcon={getDynamicIcon}
                        />
                    </div>

                    {/* Right Sidebar */}
                    <div className="w-full lg:w-[340px] xl:w-[380px] shrink-0 lg:sticky lg:top-24 self-start">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`rounded-2xl border overflow-hidden ${isHumanMode ? 'bg-white border-amber-300 shadow-amber-200/50 rounded-[3rem]' : 'bg-white border-slate-200 shadow-xl'}`}
                        >
                            <div className={`p-5 md:p-6 text-white ${isHumanMode ? 'bg-amber-600' : 'bg-[#0e121b]'}`}>
                                <h3 className={`font-normal flex items-center gap-2 text-sm uppercase tracking-widest ${isHumanMode ? 'font-hand text-2xl' : ''}`}>
                                    <User size={18} className={isHumanMode ? 'text-amber-200' : 'text-blue-600'} />Profile Overview
                                </h3>
                            </div>
                            <div className="p-5 md:p-6 space-y-4">
                                <div className="space-y-4">
                                    {displayTitle && (
                                        <div className="flex items-start gap-3 md:gap-4">
                                            <div className={`p-2.5 rounded-xl shrink-0 ${isHumanMode ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'}`}><BadgeCheck size={18} /></div>
                                            <div className="min-w-0">
                                                <p className={`text-[10px] font-normal uppercase tracking-widest mb-1 ${isHumanMode ? 'text-amber-700 font-hand text-sm' : 'text-slate-500'}`}>Headline</p>
                                                <p className={`text-sm font-medium break-words ${isHumanMode ? 'text-stone-800 font-hand text-lg' : 'text-[#0e121b]'}`}>{displayTitle}</p>
                                            </div>
                                        </div>
                                    )}
                                    {displayEducation && (
                                        <div className="flex items-start gap-3 md:gap-4">
                                            <div className={`p-2.5 rounded-xl shrink-0 ${isHumanMode ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'}`}><GraduationCap size={18} /></div>
                                            <div className="min-w-0">
                                                <p className={`text-[10px] font-normal uppercase tracking-widest mb-1 ${isHumanMode ? 'text-amber-700 font-hand text-sm' : 'text-slate-500'}`}>Education</p>
                                                <p className={`text-sm font-medium break-words ${isHumanMode ? 'text-stone-800 font-hand text-lg' : 'text-[#0e121b]'}`}>{displayEducation}</p>
                                            </div>
                                        </div>
                                    )}
                                    {displayLocation && (
                                        <div className="flex items-start gap-3 md:gap-4">
                                            <div className={`p-2.5 rounded-xl shrink-0 ${isHumanMode ? 'bg-amber-100 text-amber-600' : 'bg-blue-600 text-white'}`}><MapPin size={18} /></div>
                                            <div className="min-w-0">
                                                <p className={`text-[10px] font-normal uppercase tracking-widest mb-1 ${isHumanMode ? 'text-amber-700 font-hand text-sm' : 'text-slate-500'}`}>Location</p>
                                                <p className={`text-sm font-medium break-words ${isHumanMode ? 'text-amber-700 font-hand text-lg' : 'text-blue-600 font-bold'}`}>{displayLocation}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3 pt-2">
                                    {videoUrl && (
                                        <button onClick={() => { setIsIntroVideoOpen(true); setIsVideoMinimized(false); }}
                                            className={`w-full py-4 rounded-2xl font-normal text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all ${isHumanMode ? 'bg-[#0e121b] text-white hover:bg-slate-800' : 'bg-[#0e121b] text-white hover:bg-slate-800'}`}>
                                            <Play size={18} /> Watch Intro
                                        </button>
                                    )}
                                    <button onClick={() => { setIsContactModalOpen(true); trackEvent('lets_talk', castIdParam || "profile", { source: sourceParam, type: 'contact_modal' }); }}
                                        className={`w-full py-4 rounded-2xl font-normal text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all ${isHumanMode ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                                        <Mail size={18} />Contact
                                    </button>
                                    {/* Apple Wallet Button */}
                                    {walletPassUrl ? (
                                        <a
                                            href={walletPassUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full py-4 rounded-2xl font-normal text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all bg-green-600 text-white hover:bg-green-700"
                                        >
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
                                            Add to Apple Wallet
                                        </a>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setShowWalletUnavailable(true);
                                                setTimeout(() => setShowWalletUnavailable(false), 3000);
                                            }}
                                            className="w-full py-4 rounded-2xl font-normal text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all bg-slate-300 text-slate-500 cursor-not-allowed"
                                        >
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
                                            Add to Apple Wallet
                                        </button>
                                    )}
                                    {showWalletUnavailable && (
                                        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                                            Wallet pass not yet available. Please check back later.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </main>

            <VideoPlayer
                videoUrl={videoUrl}
                isIntroVideoOpen={isIntroVideoOpen} setIsIntroVideoOpen={setIsIntroVideoOpen}
                isVideoPlaying={isVideoPlaying} setIsVideoPlaying={setIsVideoPlaying}
                isVideoMuted={isVideoMuted} setIsVideoMuted={setIsVideoMuted}
                isVideoExpanded={isVideoExpanded} setIsVideoExpanded={setIsVideoExpanded}
                isVideoMinimized={isVideoMinimized} setIsVideoMinimized={setIsVideoMinimized}
                videoCurrentTime={videoCurrentTime} setVideoCurrentTime={setVideoCurrentTime}
                videoDuration={videoDuration} setVideoDuration={setVideoDuration}
                showControls={showControls} setShowControls={setShowControls}
                autoplayBlocked={autoplayBlocked} setAutoplayBlocked={setAutoplayBlocked}
                isHumanMode={isHumanMode} displayName={displayName}
            />

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                shareUrl={shareUrl}
                candidateName={candidateNameParam}
                displayName={displayName}
            />

            <ResumeModals
                isHireMeModalOpen={isHireMeModalOpen} setIsHireMeModalOpen={setIsHireMeModalOpen}
                isContactModalOpen={isContactModalOpen} setIsContactModalOpen={setIsContactModalOpen}
                isScheduleModalOpen={isScheduleModalOpen} setIsScheduleModalOpen={setIsScheduleModalOpen}
                displayName={displayName} displayTitle={displayTitle} displayEmail={displayEmail}
                candidatePhone={candidatePhone} isHumanMode={isHumanMode}
                handleDownloadResume={handleDownloadResume}
                handleEmailCandidate={handleEmailCandidate} handleWhatsAppCandidate={handleWhatsAppCandidate}
                handleScheduleSubmit={handleScheduleSubmit}
                formData={formData} setFormData={setFormData}
                scheduleStep={scheduleStep} setScheduleStep={setScheduleStep}
                formStatus={formStatus} statusMessage={statusMessage}
                isAvatarModalOpen={isAvatarModalOpen} setIsAvatarModalOpen={setIsAvatarModalOpen}
                onAvatarSelect={handleAvatarSelect}
                initialGender={displayName.toLowerCase().endsWith('a') || displayName.toLowerCase().includes('girl') || displayName.toLowerCase().includes('she') ? 'girl' : 'boy'}
            />
        </div>
    );
};

export default CareerIdentityPage;