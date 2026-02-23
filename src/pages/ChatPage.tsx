import React, { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import ResumeChatPanel from "../components/ResumeChatPanel";

const PORTFOLIO_URL = "https://digital-resume-sample-portfolio.vercel.app";

const ChatPage: React.FC = () => {
    const [resumeUrl, setResumeUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("resumeId");
    const openVideo = params.get("openVideo") === "true";
    const [panelMode, setPanelMode] = useState<"chat" | "video" | "resume">(
        openVideo ? "video" : "chat"
    );

    useEffect(() => {
        document.title = "Chat with Resume";

        const loadData = async () => {
            if (!resumeId) {
                setLoading(false);
                return;
            }

            try {
                const [crmResult, regularResult] = await Promise.all([
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
                ]);

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

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                width: "100vw",
                height: "100vh",
                overflow: "hidden",
            }}
        >
            {/* ── LEFT: Portfolio iframe ── */}
            <div
                style={{
                    flex: 1,
                    position: "relative",
                    overflow: "hidden",
                    minWidth: 0,
                }}
            >
                <iframe
                    src={PORTFOLIO_URL}
                    title="Portfolio"
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        display: "block",
                    }}
                    allow="fullscreen"
                />

                {/* Spinner while data loads */}
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
            </div>

            {/* ── RIGHT: Chat panel column ── */}
            <div
                style={{
                    width: 430,
                    flexShrink: 0,
                    height: "100%",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "-4px 0 24px rgba(0,0,0,0.18)",
                    zIndex: 10,
                }}
            >
                {/* The ResumeChatPanel is positioned+fixed normally —
            we override its inline styles so it fills this column exactly */}
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        overflow: "hidden",
                    }}
                >
                    {/*
            ResumeChatPanel renders with `position:fixed top-20 right-6`
            We wrap it in a transform container so it becomes position:relative
            and fills our column without leaking into the iframe.
          */}
                    <style>{`
            /* Scope the panel inside our column */
            .chat-column-wrap .fixed {
              position: absolute !important;
              top: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              left: 0 !important;
              max-width: 100% !important;
              width: 100% !important;
              height: 100% !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
          `}</style>
                    <div className="chat-column-wrap" style={{ width: "100%", height: "100%" }}>
                        <ResumeChatPanel
                            isOpen={true}
                            onClose={() => { }}
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
