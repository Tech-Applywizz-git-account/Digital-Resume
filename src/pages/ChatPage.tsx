import React, { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import ResumeChatPanel from "../components/ResumeChatPanel";
import { trackEvent, trackSessionEnd } from "../utils/tracking";

// Removed default sample portfolio URL

const ChatPage: React.FC = () => {
    const [resumeUrl, setResumeUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [dbPortfolioUrl, setDbPortfolioUrl] = useState<string | null>(null);
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("resumeId") || params.get("id");
    const source = params.get("source");
    const modeParam = params.get("mode") as "chat" | "video" | "resume" | null;
    const openVideo = params.get("openVideo") === "true" || modeParam === 'video';
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

        // 1. Initial Page Load Event
        trackEvent('page_load', resumeId);
        hasTracked.current = true;

        // 2. Detect if visitor arrived by clicking "Let's Talk" button inside the PDF
        //    URL shape: /chat?resumeId=XXX&source=pdf
        if (source === 'pdf') {
            trackEvent('lets_talk', resumeId);
        }

        // 3. Session Duration Tracking
        const handleUnload = () => {
            trackSessionEnd(resumeId);
        };

        window.addEventListener('beforeunload', handleUnload);
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [resumeId]);

    // ✅ Track Portfolio Interaction
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
                const [crmResult, regularResult, portfolioResult] = await Promise.all([
                    supabase
                        .from("crm_job_requests")
                        .select("resume_url, user_id")
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

                const data = crmResult.data || regularResult.data
                if (data?.user_id) {
                    // Fetch portfolio strictly by owner's user_id, fallback to request_id
                    const { data: userPortfolio } = await supabase
                        .from('portfolio_settings')
                        .select('url')
                        .eq('user_id', data.user_id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (userPortfolio?.url) {
                        setDbPortfolioUrl(userPortfolio.url);
                    } else {
                        // Fallback to request_id for legacy records
                        const { data: reqPortData } = await supabase
                            .from('portfolio_settings')
                            .select('url')
                            .eq('request_id', resumeId)
                            .maybeSingle();
                        if (reqPortData?.url) setDbPortfolioUrl(reqPortData.url);
                    }
                } else if (resumeId) {
                    // No user_id, rely on request_id
                    const { data: reqPortData } = await supabase
                        .from('portfolio_settings')
                        .select('url')
                        .eq('request_id', resumeId)
                        .maybeSingle();
                    if (reqPortData?.url) setDbPortfolioUrl(reqPortData.url);
                }

                // If still no portfolio after all checks, handle redirect
                if (!dbPortfolioUrl && !params.get("portfolio") && resumeId) {
                    const sourceParam = params.get("source") || "pdf";
                    const originalMode = params.get("mode");
                    const finalMode = (originalMode === "chat") ? "" : originalMode;
                    const modeParam = finalMode ? `&mode=${finalMode}` : "";
                    window.location.replace(`${window.location.origin}/final-result/${resumeId}?from=pdf&source=${sourceParam}${modeParam}&id=${resumeId}`);
                    return;
                }

                if (crmResult.data) {
                    setResumeUrl(crmResult.data.resume_url || null);
                    if (crmResult.data.user_id) setOwnerId(crmResult.data.user_id);

                    const { data: rec } = await supabase
                        .from("crm_recordings")
                        .select("video_url")
                        .eq("job_request_id", resumeId)
                        .maybeSingle();

                    if (rec?.video_url) {
                        const path = rec.video_url;
                        setVideoUrl(
                            path.startsWith("http")
                                ? path
                                : supabase.storage
                                    .from("CRM_users_recordings")
                                    .getPublicUrl(path).data.publicUrl
                        );
                    }
                } else if (regularResult.data) {
                    const data = regularResult.data;
                    setResumeUrl(data.resume_path || null);
                    if (data.user_id) setOwnerId(data.user_id);

                    const recordings = data.recordings as any;
                    if (recordings && recordings.length > 0) {
                        const path = recordings[0].storage_path;
                        if (path) {
                            setVideoUrl(
                                path.startsWith("http")
                                    ? path
                                    : supabase.storage
                                        .from("recordings")
                                        .getPublicUrl(path).data.publicUrl
                            );
                        }
                    }
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
            }, 320); // slightly after the 300ms width transition completes
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
                    className="w-full h-full border-none block"
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
                        className="absolute right-6 bottom-6 w-15 h-15 rounded-full bg-[#0B4F6C] text-white border-none shadow-2xl cursor-pointer flex items-center justify-center z-[100] transition-all duration-300 hover:scale-110 hover:-translate-y-1 active:scale-95"
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
