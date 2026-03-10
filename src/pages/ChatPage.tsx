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
                // Tracking what we found via local variables because state updates are async
                let foundResumeUrl = urlFromQuery || null;
                let foundPortfolioUrl = params.get("portfolio") || null;
                let foundOwnerId = null;

                // 1. Initial Fetch from Supabase
                const [crmResult, regularResult, portfolioResult] = await Promise.all([
                    supabase
                        .from("crm_job_requests")
                        .select("resume_url, user_id, email, company_application_email")
                        .eq("id", resumeId)
                        .maybeSingle(),
                    supabase
                        .from("job_requests")
                        .select("resume_path, user_id, recordings(storage_path)")
                        .eq("id", resumeId)
                        .maybeSingle(),
                    supabase
                        .from("portfolio_settings")
                        .select("url")
                        .eq("request_id", resumeId)
                        .maybeSingle(),
                ]);

                // 2. Resolve URLs from Supabase
                if (crmResult.data) {
                    let rUrl = crmResult.data.resume_url || null;
                    if (rUrl && !rUrl.startsWith('http')) {
                        rUrl = supabase.storage.from("CRM_users_resumes").getPublicUrl(rUrl).data.publicUrl;
                    }
                    if (!foundResumeUrl) foundResumeUrl = rUrl;

                    foundOwnerId = crmResult.data.user_id || null;
                    setOwnerId(foundOwnerId);

                    const { data: rec } = await supabase
                        .from("crm_recordings")
                        .select("video_url")
                        .eq("job_request_id", resumeId)
                        .maybeSingle();

                    if (rec?.video_url) {
                        setVideoUrl(rec.video_url.startsWith("http") ? rec.video_url :
                            supabase.storage.from("CRM_users_recordings").getPublicUrl(rec.video_url).data.publicUrl);
                    }
                } else if (regularResult.data) {
                    const data = regularResult.data;
                    let rUrl = data.resume_path || null;
                    if (rUrl && !rUrl.startsWith('http')) {
                        rUrl = supabase.storage.from("resumes").getPublicUrl(rUrl).data.publicUrl;
                    }
                    if (!foundResumeUrl) foundResumeUrl = rUrl;

                    foundOwnerId = data.user_id || null;
                    setOwnerId(foundOwnerId);

                    const recordings = data.recordings as any;
                    if (recordings && recordings.length > 0) {
                        const path = recordings[0].storage_path;
                        if (path) {
                            setVideoUrl(path.startsWith("http") ? path :
                                supabase.storage.from("recordings").getPublicUrl(path).data.publicUrl);
                        }
                    }
                }

                // 3. Resolve Portfolio
                if (portfolioResult.data?.url) {
                    foundPortfolioUrl = portfolioResult.data.url;
                } else if (foundOwnerId) {
                    const { data: userPortfolio } = await supabase
                        .from('portfolio_settings')
                        .select('url')
                        .eq('user_id', foundOwnerId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (userPortfolio?.url) foundPortfolioUrl = userPortfolio.url;
                }

                // 4. ✅ Vercel API Fallback (Crucial for API-only users or fresh uploads)
                if (!foundResumeUrl || !foundPortfolioUrl) {
                    const emailsToTry = [
                        crmResult.data?.email,
                        crmResult.data?.company_application_email,
                        params.get("email")
                    ].filter(Boolean) as string[];

                    for (const email of emailsToTry) {
                        try {
                            const response = await fetch(`/api/proxy-applywizz?email=${encodeURIComponent(email.trim().toLowerCase())}`);
                            if (response.ok) {
                                const jsonResponse = await response.json();
                                const userData = Array.isArray(jsonResponse) ? jsonResponse[0] : jsonResponse;
                                const vResumeUrl = userData?.data?.resume?.pdf_path?.[0] || userData?.resume?.pdf_path?.[0];
                                const vPortfolioUrl = userData?.data?.portfolio?.link || userData?.portfolio?.link;

                                if (vResumeUrl && !foundResumeUrl) {
                                    foundResumeUrl = vResumeUrl;
                                    // ✅ Sync with Supabase
                                    if (resumeId && resumeId !== 'profile') {
                                        console.log("🔄 Syncing external resume to Supabase (from ChatPage):", resumeId);
                                        Promise.all([
                                            supabase.from('crm_job_requests').update({ resume_url: vResumeUrl }).eq('id', resumeId).is('resume_url', null),
                                            supabase.from('job_requests').update({ resume_path: vResumeUrl }).eq('id', resumeId).is('resume_path', null)
                                        ]).catch(err => console.error("❌ Sync failed:", err));
                                    }
                                }
                                if (vPortfolioUrl && !foundPortfolioUrl) foundPortfolioUrl = vPortfolioUrl;

                                if (foundResumeUrl && foundPortfolioUrl) break;
                            }
                        } catch (err) {
                            console.error("❌ Vercel fallback fetch error:", err);
                        }
                    }
                }

                // Update final states
                setResumeUrl(foundResumeUrl);
                setDbPortfolioUrl(foundPortfolioUrl);

                // 5. Final validation - ensure we have a portfolio to show
                if (!foundPortfolioUrl && resumeId !== 'profile') {
                    // Redirect back if no portfolio found to show alongside chat
                    const sourceParam = params.get("source") || "pdf";
                    window.location.replace(`${window.location.origin}/final-result/${resumeId}?from=pdf&source=${sourceParam}&id=${resumeId}`);
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
