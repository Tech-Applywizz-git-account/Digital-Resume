import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Video, Minimize2, Maximize2, X, Pause, Play,
    Volume2, VolumeX, Settings
} from 'lucide-react';

const Tape = ({ className = "" }: { className?: string }) => (
    <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05, rotate: 2 }}
        className={`absolute h-6 w-16 bg-amber-200/40 backdrop-blur-[1px] border border-amber-300/20 shadow-sm z-10 ${className}`}
        style={{ clipPath: 'polygon(5% 0%, 95% 2%, 100% 50%, 98% 95%, 5% 100%, 0% 50%)' }} />
);

interface VideoPlayerProps {
    videoUrl: string | null;
    isIntroVideoOpen: boolean;
    setIsIntroVideoOpen: (open: boolean) => void;
    isVideoPlaying: boolean;
    setIsVideoPlaying: (playing: boolean) => void;
    isVideoMuted: boolean;
    setIsVideoMuted: (muted: boolean) => void;
    isVideoExpanded: boolean;
    setIsVideoExpanded: (expanded: boolean) => void;
    isVideoMinimized: boolean;
    setIsVideoMinimized: (minimized: boolean) => void;
    videoCurrentTime: number;
    setVideoCurrentTime: (time: number) => void;
    videoDuration: number;
    setVideoDuration: (duration: number) => void;
    showControls: boolean;
    setShowControls: (show: boolean) => void;
    autoplayBlocked: boolean;
    setAutoplayBlocked: (blocked: boolean) => void;
    isHumanMode: boolean;
    displayName: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    videoUrl,
    isIntroVideoOpen,
    setIsIntroVideoOpen,
    isVideoPlaying,
    setIsVideoPlaying,
    isVideoMuted,
    setIsVideoMuted,
    isVideoExpanded,
    setIsVideoExpanded,
    isVideoMinimized,
    setIsVideoMinimized,
    videoCurrentTime,
    setVideoCurrentTime,
    videoDuration,
    setVideoDuration,
    showControls,
    setShowControls,
    autoplayBlocked,
    setAutoplayBlocked,
    isHumanMode,
    displayName
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setVideoCurrentTime(videoRef.current.currentTime);
            setVideoDuration(videoRef.current.duration || 0);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleTogglePlay = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(err => console.error('Play failed:', err));
        } else {
            videoRef.current.pause();
        }
    };

    useEffect(() => {
        if (isIntroVideoOpen && isVideoPlaying && videoRef.current) {
            const vid = videoRef.current;
            vid.muted = true;
            vid.play().then(() => {
                setTimeout(() => {
                    if (videoRef.current) {
                        videoRef.current.muted = false;
                        setIsVideoMuted(false);
                    }
                }, 300);
            }).catch(error => {
                console.error('Video autoplay failed even muted:', error);
                setIsVideoPlaying(false);
                setAutoplayBlocked(true);
            });
        }
    }, [isIntroVideoOpen, isVideoPlaying]);

    if (!isIntroVideoOpen || !videoUrl) return null;

    return (
        <AnimatePresence>
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
                        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsVideoMinimized(true); }}
                                className="p-1.5 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-lg transition-all text-white border border-white/20 shadow-lg"
                                title="Minimize to Bubble"
                            >
                                <Minimize2 size={14} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsVideoExpanded(!isVideoExpanded); }}
                                className="p-1.5 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-lg transition-all text-white border border-white/20 shadow-lg"
                                title={isVideoExpanded ? "Exit Fullscreen" : "Fullscreen"}
                            >
                                {isVideoExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsIntroVideoOpen(false); setIsVideoExpanded(false); setIsVideoMinimized(false); }}
                                className="p-1.5 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-lg transition-all text-white border border-white/20 shadow-lg"
                                title="Close Video"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <video
                            ref={videoRef}
                            key={videoUrl}
                            src={videoUrl}
                            muted={isVideoMuted}
                            playsInline
                            className="w-full h-full object-contain bg-black"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePlay();
                            }}
                            onPlay={() => setIsVideoPlaying(true)}
                            onPause={() => setIsVideoPlaying(false)}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={() => {
                                setVideoDuration(videoRef.current?.duration || 0);
                            }}
                        />

                        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 flex flex-col justify-between p-4 z-10 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="flex justify-between items-start">
                                <div className={`bg-black/20 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-white/80 tracking-wider uppercase ${isHumanMode ? 'font-hand text-sm text-amber-200' : ''}`}>
                                    Intro Pitch
                                </div>
                            </div>

                            <div className="flex items-center justify-center pointer-events-auto">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleTogglePlay(); }}
                                    className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-all transform hover:scale-110 shadow-2xl"
                                >
                                    {isVideoPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                                </button>
                            </div>

                            <div className="space-y-3 pointer-events-auto">
                                <div className="relative h-1 w-full bg-white/20 rounded-full overflow-hidden group/progress cursor-pointer">
                                    <div
                                        className={`absolute top-0 left-0 h-full transition-all duration-300 ${isHumanMode ? 'bg-amber-500' : 'bg-blue-500'}`}
                                        style={{ width: `${videoDuration > 0 ? (videoCurrentTime / videoDuration) * 100 : 0}%` }}
                                    ></div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleTogglePlay(); }}
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
                                        <span className={`text-[10px] font-mono text-white/60 ${isHumanMode ? 'font-hand text-sm text-amber-200/60' : ''}`}>
                                            {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <button onClick={(e) => e.stopPropagation()} className="text-white hover:text-blue-400 transition-colors">
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

                        {autoplayBlocked && !isVideoPlaying && (
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer z-20"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setAutoplayBlocked(false);
                                    handleTogglePlay();
                                }}
                            >
                                <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/40 hover:bg-white/30 transition-all transform hover:scale-110 shadow-2xl mb-3">
                                    <Play size={32} fill="white" className="text-white ml-1" />
                                </div>
                                <p className="text-white text-sm font-semibold tracking-wide">Click to Play</p>
                                <p className="text-white/60 text-xs mt-1">Autoplay was blocked by your browser</p>
                            </div>
                        )}

                        {!isVideoPlaying && !showControls && !autoplayBlocked && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-12 w-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                                    <Play size={24} className="text-white fill-white/10 ml-1" />
                                </div>
                            </div>
                        )}

                        <div className={`absolute bottom-3 left-3 right-3 text-white transition-opacity duration-300 ${showControls ? 'opacity-0' : 'opacity-80'}`}>
                            <p className="font-bold text-[10px] leading-tight">{displayName} — Intro Pitch</p>
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};