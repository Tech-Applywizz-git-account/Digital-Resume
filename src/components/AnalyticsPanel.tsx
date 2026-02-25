import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import {
    BarChart3,
    MapPin,
    Smartphone,
    Monitor,
    Download,
    MessageSquare,
    Play,
    X,
    Users,
    Eye,
    Activity,
    Loader2,
    Globe,
    Clock,
    ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnalyticsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    castId: string;
    resumeTitle: string;
}

export default function AnalyticsPanel({ isOpen, onClose, castId, resumeTitle }: AnalyticsPanelProps) {
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState('all');

    const [stats, setStats] = useState({
        totalViews: 0,
        uniqueVisitors: 0,
        avgDuration: 0,
        pdfDownloads: 0,
        videoPlays: 0,
        chatOpens: 0,
        portfolioClicks: 0
    });

    useEffect(() => {
        if (isOpen) {
            fetchAnalytics();
        }
    }, [isOpen, castId, timeRange]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // Fetch everything from resume_sessions (the single source of truth)
            let query = supabase
                .from('resume_sessions')
                .select('*')
                .order('started_at', { ascending: false });

            // Only filter by resume_id if a specific ID is provided
            if (castId) {
                query = query.eq('resume_id', castId);
            }

            if (timeRange === '7d') {
                const date = new Date();
                date.setDate(date.getDate() - 7);
                query = query.gte('started_at', date.toISOString());
            } else if (timeRange === '30d') {
                const date = new Date();
                date.setDate(date.getDate() - 30);
                query = query.gte('started_at', date.toISOString());
            }

            const { data, error } = await query;
            if (error) throw error;

            const sessionData = data || [];
            setSessions(sessionData);

            // Process Stats
            const uniqueIps = new Set(sessionData.map(s => s.ip_address)).size;
            const totalDuration = sessionData.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0);
            const avgDuration = sessionData.length > 0 ? Math.round(totalDuration / sessionData.length) : 0;

            setStats({
                totalViews: sessionData.length,
                uniqueVisitors: uniqueIps,
                avgDuration,
                pdfDownloads: sessionData.filter(s => s.pdf_downloaded).length,
                videoPlays: sessionData.filter(s => s.video_clicked).length,
                chatOpens: sessionData.filter(s => s.chat_opened).length,
                portfolioClicks: sessionData.filter(s => s.portfolio_clicked).length
            });

        } catch (err) {
            console.error('Error fetching analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    const getCountryStats = () => {
        const map: Record<string, number> = {};
        sessions.forEach(s => {
            const c = s.country || 'Unknown';
            map[c] = (map[c] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    };

    const getTimeAgo = (dateStr: string | null | undefined) => {
        if (!dateStr) return 'Recently';
        const date = new Date(dateStr);
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#F8FAFC] shadow-2xl z-[70] overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 line-clamp-1">{resumeTitle}</h2>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-[#0B4F6C] uppercase tracking-widest mt-0.5">
                                    <Activity className="w-3 h-3" /> Session Performance
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                    <Loader2 className="w-10 h-10 text-[#0B4F6C] animate-spin mb-4" />
                                    <p className="text-slate-500 font-medium">Loading Consolidated Stats...</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Time Filter */}
                                    <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                        {['all', '30d', '7d'].map((range) => (
                                            <button
                                                key={range}
                                                onClick={() => setTimeRange(range)}
                                                className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest ${timeRange === range ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                                                    }`}
                                            >
                                                {range === 'all' ? 'All Time' : range === '30d' ? '30 Days' : '7 Days'}
                                            </button>
                                        ))}
                                    </div>

                                    {/* High Level Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                <Users className="w-3 h-3" /> Total Visitors
                                            </p>
                                            <p className="text-2xl font-black text-slate-900">{stats.totalViews}</p>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                <Activity className="w-3 h-3" /> Unique IPs
                                            </p>
                                            <p className="text-2xl font-black text-slate-900">{stats.uniqueVisitors}</p>
                                        </div>
                                    </div>

                                    {/* Conversion Funnel */}
                                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                                        <h3 className="text-xs font-bold text-slate-800 mb-6 uppercase tracking-widest">Action Summary</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${stats.videoPlays > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-300'}`}>
                                                    <Play className="w-6 h-6" fill={stats.videoPlays > 0 ? "currentColor" : "none"} />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900">{stats.videoPlays}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Intro Viewed</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${stats.chatOpens > 0 ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-300'}`}>
                                                    <MessageSquare className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900">{stats.chatOpens}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Chat Started</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${stats.pdfDownloads > 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-300'}`}>
                                                    <Download className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900">{stats.pdfDownloads}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Resumes Saved</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${stats.avgDuration > 0 ? 'bg-purple-50 text-purple-500' : 'bg-slate-50 text-slate-300'}`}>
                                                    <Clock className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900">{stats.avgDuration}s</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Avg Depth</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Geo Chart */}
                                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                                        <h3 className="text-xs font-bold text-slate-800 mb-6 uppercase tracking-widest">Geographic Reach</h3>
                                        <div className="space-y-4">
                                            {getCountryStats().map(([country, count]) => (
                                                <div key={country}>
                                                    <div className="flex items-center justify-between text-[11px] font-black mb-1.5">
                                                        <span className="text-slate-500 uppercase">{country}</span>
                                                        <span className="text-slate-900">{count} visitors</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${(count / (stats.totalViews || 1)) * 100}%` }}
                                                            className="h-full bg-[#0B4F6C]"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Detailed Visitor Log */}
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-800 mb-4 px-2 uppercase tracking-widest">Recent Visitors</h3>
                                        <div className="space-y-3">
                                            {sessions.slice(0, 15).map(s => (
                                                <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-100 flex flex-col gap-4 group transition-all hover:shadow-md">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-[#0B4F6C10] flex items-center justify-center text-[#0B4F6C]">
                                                                {s.device === 'Mobile' ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-slate-900 uppercase">{s.country || 'Unknown Location'}</p>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase">{getTimeAgo(s.started_at)}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-black text-[#0B4F6C]">{s.duration_seconds || 0}s</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Stay Duration</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                                                        <span className="px-2 py-1 rounded bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Viewed</span>
                                                        {s.video_clicked && <span className="px-2 py-1 rounded bg-red-50 text-[9px] font-black text-red-500 uppercase tracking-tighter flex items-center gap-1"><Play className="w-2.5 h-2.5" /> Video</span>}
                                                        {s.chat_opened && <span className="px-2 py-1 rounded bg-blue-50 text-[9px] font-black text-blue-500 uppercase tracking-tighter flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> Chat</span>}
                                                        {s.pdf_downloaded && <span className="px-2 py-1 rounded bg-emerald-50 text-[9px] font-black text-emerald-500 uppercase tracking-tighter flex items-center gap-1"><Download className="w-2.5 h-2.5" /> PDF</span>}
                                                        {s.portfolio_clicked && <span className="px-2 py-1 rounded bg-purple-50 text-[9px] font-black text-purple-500 uppercase tracking-tighter flex items-center gap-1"><ExternalLink className="w-2.5 h-2.5" /> Portfolio</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
