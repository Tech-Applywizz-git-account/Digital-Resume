import React, { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import ResumeChatPanel from "../components/ResumeChatPanel";
import { trackEvent, trackSessionEnd } from "../utils/tracking";

const PORTFOLIO_URL = "https://digital-resume-sample-portfolio.vercel.app";

const ChatPage: React.FC = () => {
    const [resumeUrl, setResumeUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [dbPortfolioUrl, setDbPortfolioUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("resumeId");
    const source = params.get("source");
    const modeParam = params.get("mode") as "chat" | "video" | "resume" | null;
    const openVideo = params.get("openVideo") === "true" || modeParam === 'video';
    const portfolioUrl = params.get("portfolio") || dbPortfolioUrl;

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

                if (portfolioResult.data?.url) {
                    setDbPortfolioUrl(portfolioResult.data.url);
                }

                if (crmResult.data) {
                    setResumeUrl(crmResult.data.resume_url || null);

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
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                width: "100%",
                height: "100vh",
                overflow: "hidden",
                position: "relative",
            }}
        >
            {/* ── LEFT: Portfolio Section ── */}
            <div
                onClick={handlePortfolioInteraction}
                style={{
                    flex: 1,
                    position: "relative",
                    overflow: "hidden",
                    height: "100%",
                    minWidth: 0,
                    backgroundColor: "#000",
                }}
            >
                <iframe
                    ref={iframeRef}
                    src={portfolioUrl || PORTFOLIO_URL}
                    title="Portfolio"
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        display: "block",
                    }}
                    allow="fullscreen"
                />


                {loading && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            pointerEvents: "none",
                            zIndex: 10,
                        }}
                    >
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                border: "3px solid rgba(255,255,255,0.3)",
                                borderTopColor: "#2dd4bf",
                                borderRadius: "50%",
                                animation: "spin 0.8s linear infinite",
                            }}
                        />
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                )}

                {!isPanelOpen && (
                    <button
                        onClick={() => setIsPanelOpen(true)}
                        style={{
                            position: "absolute",
                            right: "24px",
                            bottom: "24px",
                            width: "60px",
                            height: "60px",
                            borderRadius: "50%",
                            backgroundColor: "#0B4F6C",
                            color: "white",
                            border: "none",
                            boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 100,
                            transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.1) translateY(-5px)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1) translateY(0)";
                        }}
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
                        </svg>
                    </button>
                )}
            </div>

            {/* ── RIGHT: Chat Panel Section ── */}
            <div
                style={{
                    width: isPanelOpen ? 430 : 0,
                    flexShrink: 0,
                    height: "100%",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: isPanelOpen ? "-8px 0 32px rgba(0,0,0,0.15)" : "none",
                    zIndex: 20,
                    transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    overflow: "hidden",
                    backgroundColor: "white",
                }}
            >
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        overflow: "hidden",
                    }}
                >
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
                    <div className="chat-column-wrap" style={{ width: "100%", height: "100%" }}>
                        <ResumeChatPanel
                            isOpen={isPanelOpen}
                            onClose={() => setIsPanelOpen(false)}
                            mode={panelMode}
                            videoUrl={videoUrl}
                            resumeUrl={resumeUrl}
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
