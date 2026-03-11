import React, { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import ResumeChatPanel from "../components/ResumeChatPanel";
import { trackEvent, trackSessionEnd } from "../utils/tracking";

const ChatPage: React.FC = () => {
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("resumeId") || params.get("id");
    const source = params.get("source");
    const modeParam = params.get("mode") as "chat" | "video" | "resume" | null;
    const openVideo = params.get("openVideo") === "true" || modeParam === 'video';
    const urlFromQuery = params.get("resumeUrl");

    const [resumeUrl, setResumeUrl] = useState<string | null>(urlFromQuery || null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [dbPortfolioUrl, setDbPortfolioUrl] = useState<string | null>(null);
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const portfolioUrl = dbPortfolioUrl || params.get("portfolio");

    const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
    const [panelMode, setPanelMode] = useState<"chat" | "video" | "resume">(
        modeParam || (openVideo ? "video" : "chat")
    );

    const hasTracked = React.useRef(false);
    // ✅ Ensure panel is open if mode is explicitly requested
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    useEffect(() => {
        if (modeParam) {
            setIsPanelOpen(true);
            setPanelMode(modeParam);
        }
    }, [modeParam]);

    // ✅ Centralized Tracking Implementation
    useEffect(() => {
        if (!resumeId || hasTracked.current) return;

        trackEvent('page_load', resumeId);
        hasTracked.current = true;

        if (source === 'pdf') {
            trackEvent('lets_talk', resumeId);
        }

        const handleUnload = () => {
            trackSessionEnd(resumeId);
        };

        window.addEventListener('beforeunload', handleUnload);
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [resumeId]);

    const handlePortfolioInteraction = () => {
        if (resumeId) {
            trackEvent('portfolio_click', resumeId);
        }
    };

    useEffect(() => {
        document.title = "Chat with Resume";

        const loadData = async () => {
            if (!resumeId) {
                setLoading(false);
                return;
            }

            try {
                // Tracking discovery locally to avoid stale state issues during async ops
                let foundResumeUrl = urlFromQuery || null;
                let foundPortfolioUrl = params.get("portfolio") || null;
                let foundOwnerId = null;

                // 1. Initial Fetch from Supabase (Resumes & User Info)
                // We run these in parallel, but handle their results individually to be robust.
                const [crmResult, regularResult] = await Promise.all([
                    supabase.from("crm_job_requests").select("resume_url, user_id, email").eq("id", resumeId).maybeSingle(),
                    supabase.from("job_requests").select("resume_path, user_id, candidate_email, recordings(storage_path)").eq("id", resumeId).maybeSingle()
                ]);

                // 2. Resolve URLs & Identity from Supabase
                const dbData = crmResult.data || regularResult.data;
                let dbEmail = params.get("email");

                if (dbData) {
                    foundOwnerId = dbData.user_id || null;
                    if (foundOwnerId) setOwnerId(foundOwnerId);

                    // Resolve Resume URL from DB
                    let rUrl = (dbData as any).resume_url || (dbData as any).resume_path || null;
                    dbEmail = (dbData as any).email || (dbData as any).candidate_email || dbEmail;

                    // Fallback: If email is missing, lookup from profiles via ownerId
                    if (!dbEmail && foundOwnerId) {
                        const { data: profile } = await supabase.from('profiles').select('email').eq('id', foundOwnerId).maybeSingle();
                        if (profile?.email) dbEmail = profile.email;
                    }

                    // Fallback 1: Check crm_resumes table if URL is missing in the request
                    if (!rUrl && dbEmail) {
                        const { data: crmRes } = await supabase.from('crm_resumes')
                            .select('resume_url')
                            .eq('email', dbEmail)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        if (crmRes?.resume_url) rUrl = crmRes.resume_url;
                    }

                    // Fallback 2: Check digital_resume_by_crm table
                    if (!rUrl && dbEmail) {
                        const { data: crmUser } = await supabase.from('digital_resume_by_crm')
                            .select('resume_url')
                            .eq('email', dbEmail)
                            .maybeSingle();
                        if (crmUser?.resume_url) rUrl = crmUser.resume_url;
                    }

                    if (rUrl && !rUrl.startsWith('http')) {
                        const bucket = crmResult.data ? "CRM_users_resumes" : "resumes";
                        rUrl = supabase.storage.from(bucket).getPublicUrl(rUrl).data.publicUrl;
                    }
                    if (!foundResumeUrl) foundResumeUrl = rUrl;

                    // Resolve Video URL
                    if (crmResult.data) {
                        const { data: rec } = await supabase.from("crm_recordings").select("video_url").eq("job_request_id", resumeId).maybeSingle();
                        if (rec?.video_url) {
                            setVideoUrl(rec.video_url.startsWith("http") ? rec.video_url :
                                supabase.storage.from("CRM_users_recordings").getPublicUrl(rec.video_url).data.publicUrl);
                        }
                    } else if (regularResult.data) {
                        const recordings = regularResult.data.recordings as any;
                        if (recordings && recordings.length > 0) {
                            const path = recordings[0].storage_path;
                            if (path) {
                                setVideoUrl(path.startsWith("http") ? path :
                                    supabase.storage.from("recordings").getPublicUrl(path).data.publicUrl);
                            }
                        }
                    }
                }

                // 3. Resolve Portfolio (Using user_id column, correctly)
                if (foundPortfolioUrl) {
                    setDbPortfolioUrl(foundPortfolioUrl);
                } else if (foundOwnerId) {
                    const { data: portfolioSettings } = await supabase
                        .from('portfolio_settings')
                        .select('url')
                        .eq('user_id', foundOwnerId)
                        .maybeSingle();

                    if (portfolioSettings?.url) {
                        foundPortfolioUrl = portfolioSettings.url;
                        setDbPortfolioUrl(foundPortfolioUrl);
                    }
                }

                // 4. ✅ Vercel API Fallback (Crucial for discovery when DB record is missing URL/Portfolio)
                if (!foundResumeUrl || !foundPortfolioUrl) {
                    const emailsToTry = [
                        dbEmail as string,
                        crmResult.data?.email,
                        (regularResult.data as any)?.candidate_email,
                        params.get("email")
                    ].filter(Boolean) as string[];

                    for (const email of emailsToTry) {
                        try {
                            const response = await fetch(`/api/proxy-applywizz?email=${encodeURIComponent(email.trim().toLowerCase())}`);
                            if (response.ok) {
                                const jsonResponse = await response.json();
                                const userData = Array.isArray(jsonResponse) ? jsonResponse[0] : jsonResponse;
                                if (!userData) continue;

                                const vResumeUrl = userData?.data?.resume?.pdf_path?.[0] || userData?.resume?.pdf_path?.[0];
                                const vPortfolioUrl = userData?.data?.portfolio?.link || userData?.portfolio?.link;

                                if (vResumeUrl && !foundResumeUrl) {
                                    foundResumeUrl = vResumeUrl;
                                    // Async sync back to DB
                                    if (resumeId && resumeId !== 'profile') {
                                        const updateObj = crmResult.data ? { resume_url: vResumeUrl } : { resume_path: vResumeUrl };
                                        const table = crmResult.data ? 'crm_job_requests' : 'job_requests';
                                        supabase.from(table).update(updateObj).eq('id', resumeId).then(() => console.log("✅ Synced resume path"));
                                    }
                                }

                                if (vPortfolioUrl && !foundPortfolioUrl) {
                                    foundPortfolioUrl = vPortfolioUrl;
                                    setDbPortfolioUrl(vPortfolioUrl);
                                    // Async sync back to DB if we have an owner
                                    if (foundOwnerId) {
                                        supabase.from('portfolio_settings')
                                            .upsert({ user_id: foundOwnerId, url: vPortfolioUrl })
                                            .then(() => console.log("✅ Synced portfolio URL"));
                                    }
                                }

                                if (foundResumeUrl && foundPortfolioUrl) break;
                            }
                        } catch (err) {
                            console.error("❌ Vercel discovery error:", err);
                        }
                    }
                }

                // Final updates to state
                setResumeUrl(foundResumeUrl);

                // 5. Final validation - redirect if we literally have nothing to show for a non-profile request
                if (!foundPortfolioUrl && resumeId !== 'profile') {
                    console.warn("⚠️ No portfolio found for ID, redirecting to result page:", resumeId);
                    window.location.replace(`${window.location.origin}/final-result/${resumeId}?from=pdf&source=pdf&id=${resumeId}`);
                }

            } catch (err) {
                console.error("ChatPage load error:", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [resumeId]);

    // ✅ Reload iframe when panel closes so Three.js reinitialises at full width
    useEffect(() => {
        if (!isPanelOpen) {
            const timer = setTimeout(() => {
                if (iframeRef.current) {
                    const src = iframeRef.current.src;
                    iframeRef.current.src = "";
                    requestAnimationFrame(() => {
                        if (iframeRef.current) iframeRef.current.src = src;
                    });
                }
            }, 320);
            return () => clearTimeout(timer);
        }
    }, [isPanelOpen]);

    return (
        <div className="flex flex-col md:flex-row w-full h-screen overflow-hidden relative bg-black">
            {/* ── LEFT/TOP: Portfolio Section ── */}
            <div
                onClick={handlePortfolioInteraction}
                className={`relative overflow-hidden min-w-0 bg-black transition-all duration-300 ease-in-out
                    ${isPanelOpen ? 'h-[40vh] md:h-full flex-1' : 'h-full flex-1'}
                `}
            >
                <iframe
                    ref={iframeRef}
                    src={portfolioUrl || ""}
                    title="Portfolio"
                    className="w-full h-full border-0 block"
                    allow="fullscreen"
                />

                {loading && (
                    <div className="absolute inset-0 bg-black/15 flex items-center justify-center pointer-events-none z-10">
                        <div className="w-9 h-9 border-3 border-white/30 border-t-teal-400 rounded-full animate-spin" />
                    </div>
                )}

                {!isPanelOpen && (
                    <button
                        onClick={() => setIsPanelOpen(true)}
                        className="absolute right-6 bottom-6 w-15 h-15 rounded-full bg-[#0B4F6C] text-white border-0 shadow-2xl cursor-pointer flex items-center justify-center z-[100] transition-all duration-300 hover:scale-110 hover:-translate-y-1 active:scale-95"
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
                        </svg>
                    </button>
                )}
            </div>

            {/* ── RIGHT/BOTTOM: Chat Panel Section ── */}
            <div
                className={`bg-white transition-all duration-300 ease-in-out z-20 overflow-hidden flex flex-col shadow-[-8px_0_32px_rgba(0,0,0,0.15)]
                    ${isPanelOpen
                        ? 'h-[60vh] md:h-full w-full md:w-[320px] lg:w-[430px] opacity-100'
                        : 'h-0 md:h-full w-full md:w-0 opacity-0 md:opacity-100'}
                `}
            >
                <div className="relative w-full h-full overflow-hidden">
                    <style>{`
                        .chat-column-wrap {
                            width: 100% !important;
                            height: 100% !important;
                        }
                        .chat-column-wrap > div {
                            position: absolute !important;
                            top: 0 !important;
                            right: 0 !important;
                            bottom: 0 !important;
                            left: 0 !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            height: 100% !important;
                            border-radius: 0 !important;
                            box-shadow: none !important;
                            margin: 0 !important;
                            visibility: visible !important;
                            display: flex !important;
                        }
                        .chat-column-wrap > div > div:first-child {
                            border-radius: 0 !important;
                        }
                    `}</style>
                    <div className="chat-column-wrap w-full h-full">
                        <ResumeChatPanel
                            isOpen={isPanelOpen}
                            onClose={() => setIsPanelOpen(false)}
                            mode={panelMode}
                            videoUrl={videoUrl}
                            resumeUrl={resumeUrl}
                            ownerId={ownerId}
                            onModeChange={(m) => setPanelMode(m)}
                            isDataLoading={loading}
                            recruiterMode={true}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatPage;
