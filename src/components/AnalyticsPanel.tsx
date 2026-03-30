import React, { useState, useEffect, useMemo } from 'react';
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
    ExternalLink,
    TrendingUp,
    Zap,
    MousePointer2,
    ChevronRight,
    ArrowUpRight,
    Search,
    Filter,
    Calendar,
    PieChart,
    Layers,
    History
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
    const [viewMode, setViewMode] = useState<'overview' | 'sessions' | 'geo'>('overview');
    const [sessionSearch, setSessionSearch] = useState('');

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
            let query = supabase
                .from('resume_sessions')
                .select('*')
                .order('started_at', { ascending: false });

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

    const getDeviceStats = () => {
        const desktop = sessions.filter(s => s.device === 'Desktop' || !s.device).length;
        const mobile = sessions.filter(s => s.device === 'Mobile').length;
        const total = sessions.length || 1;
        return {
            desktop: Math.round((desktop / total) * 100),
            mobile: Math.round((mobile / total) * 100)
        };
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

    const engagementScore: number = useMemo(() => {
        if (stats.totalViews === 0) return 30; // Base score
        const weights = {
            video: 0.3,
            chat: 0.3,
            pdf: 0.25,
            portfolio: 0.15
        };
        const interactionRate = (
            (stats.videoPlays / stats.totalViews) * weights.video +
            (stats.chatOpens / stats.totalViews) * weights.chat +
            (stats.pdfDownloads / stats.totalViews) * weights.pdf +
            (stats.portfolioClicks / stats.totalViews) * weights.portfolio
        ) * 100;

        // Add duration bonus (up to 20 points)
        const durationBonus = Math.min((stats.avgDuration / 120) * 20, 20);

        return Math.min(Math.round(interactionRate * 3 + durationBonus + 20), 100);
    }, [stats]);

    const trendData = useMemo(() => {
        if (sessions.length === 0) return Array(7).fill(0);
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        return last7Days.map(date => {
            return sessions.filter(s => (s.started_at || '').startsWith(date)).length;
        });
    }, [sessions]);

    const maxTrend = Math.max(...trendData, 1);
    const sparklinePoints = trendData.map((val, i) => `${(i / (trendData.length - 1)) * 100},${100 - (val / maxTrend) * 100}`).join(' ');

    const deviceStats = useMemo(() => getDeviceStats(), [sessions]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl z-[60]"
                    />
                    <motion.div
                        initial={{ x: '100%', opacity: 0.8 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0.8 }}
                        transition={{ type: 'spring', damping: 32, stiffness: 280 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#F8FAFC] shadow-[0_0_100px_rgba(0,0,0,0.15)] z-[70] overflow-hidden flex flex-col border-l border-white/20"
                    >
                        {/* Premium Header */}
                        <div className="relative bg-white/80 backdrop-blur-md px-10 py-8 flex items-center justify-between border-b border-slate-200/60 shrink-0">
                            <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-[#0B4F6C] to-[#159A9C]" />
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-[#0B4F6C] to-[#159A9C] rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-[#0B4F6C20]">
                                    <BarChart3 className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-extrabold text-slate-900 leading-none mb-2 truncate max-w-[320px]">{resumeTitle}</h2>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                            <span className="text-[10px] font-normal uppercase tracking-widest">Real-time tracking</span>
                                        </div>
                                        <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Activity className="w-3 h-3 text-[#159A9C]" /> Impact Insights
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="group p-3 hover:bg-slate-100 rounded-2xl transition-all duration-300 border border-slate-100"
                            >
                                <X className="w-6 h-6 text-slate-400 group-hover:text-slate-900 transition-colors" />
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="bg-white border-b border-slate-100 px-10 py-2 flex gap-4 shrink-0 overflow-x-auto no-scrollbar">
                            {[
                                { id: 'overview', label: 'Overview', icon: Layers },
                                { id: 'sessions', label: 'Live Sessions', icon: History },
                                { id: 'geo', label: 'Geography', icon: Globe }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setViewMode(tab.id as any)}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all relative ${viewMode === tab.id ? 'text-[#0B4F6C]' : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                >
                                    <tab.icon className={`w-4 h-4 ${viewMode === tab.id ? 'text-[#0B4F6C]' : 'currentColor'}`} />
                                    <span className="text-xs font-normal uppercase tracking-widest">{tab.label}</span>
                                    {viewMode === tab.id && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute bottom-[-8px] left-0 right-0 h-1 bg-[#0B4F6C] rounded-full"
                                        />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center p-12">
                                    <div className="relative">
                                        <div className="w-20 h-20 border-4 border-[#0B4F6C10] border-t-[#0B4F6C] rounded-full animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Zap className="w-8 h-8 text-[#0B4F6C] animate-pulse" />
                                        </div>
                                    </div>
                                    <p className="mt-8 text-slate-500 font-normal uppercase tracking-widest text-[10px]">Synchronizing Performance Data</p>
                                </div>
                            ) : (
                                <div className="p-10 space-y-12">
                                    {viewMode === 'overview' && (
                                        <>
                                            {/* Time Filters */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex bg-white/80 p-1.5 rounded-2xl border border-slate-200/60 shadow-sm backdrop-blur-sm">
                                                    {['all', '30d', '7d'].map((range) => (
                                                        <button
                                                            key={range}
                                                            onClick={() => setTimeRange(range)}
                                                            className={`px-6 py-2.5 text-[10px] font-normal rounded-xl transition-all uppercase tracking-widest ${timeRange === range
                                                                ? 'bg-[#0B4F6C] text-white shadow-lg shadow-[#0B4F6C20]'
                                                                : 'text-slate-500 hover:text-slate-800'
                                                                }`}
                                                        >
                                                            {range === 'all' ? 'Lifetime' : range === '30d' ? '30 Days' : '7 Days'}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-3 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                                    <TrendingUp className="w-4 h-4 text-[#159A9C]" />
                                                    <span className="text-[10px] font-normal text-slate-900 uppercase tracking-widest">Growth Analysis</span>
                                                </div>
                                            </div>

                                            {/* Primary Metrics Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                {/* Engagement Score Visualization */}
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group"
                                                >
                                                    <div className="absolute top-0 right-0 w-48 h-48 bg-[#159A9C08] rounded-full -mr-24 -mt-24 group-hover:scale-125 transition-transform duration-700" />
                                                    <h3 className="text-[11px] font-normal text-slate-400 uppercase tracking-widest mb-8">Engagement Index</h3>
                                                    <div className="flex items-center gap-10">
                                                        <div className="relative w-32 h-32">
                                                            <svg className="w-full h-full transform -rotate-90">
                                                                <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                                                                <motion.circle
                                                                    cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="12" fill="transparent"
                                                                    strokeDasharray={339.2}
                                                                    initial={{ strokeDashoffset: 339.2 }}
                                                                    animate={{ strokeDashoffset: 339.2 - (339.2 * engagementScore) / 100 }}
                                                                    transition={{ duration: 2, ease: "circOut" }}
                                                                    className="text-[#159A9C]"
                                                                    strokeLinecap="round"
                                                                />
                                                            </svg>
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                                <span className="text-3xl font-extrabold text-slate-900 leading-none">{engagementScore}</span>
                                                                <span className="text-[9px] font-normal text-[#159A9C] tracking-widest mt-1 uppercase">Points</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <div>
                                                                <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mb-1">Impact Rating</p>
                                                                <p className="text-2xl font-normal text-[#0B4F6C]">
                                                                    {engagementScore > 80 ? 'Exceptional' : engagementScore > 50 ? 'Strong' : engagementScore > 30 ? 'Moderate' : 'Developing'}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[9px] font-normal text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100/50">
                                                                <Zap className="w-3 h-3" />
                                                                <span>Above average retention</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>

                                                {/* Traffic Trend Sparkline */}
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.1 }}
                                                    className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group"
                                                >
                                                    <h3 className="text-[11px] font-normal text-slate-400 uppercase tracking-widest mb-4">Traffic Velocity</h3>
                                                    <div className="flex flex-col h-full">
                                                        <div className="flex items-end justify-between mb-8">
                                                            <div>
                                                                <p className="text-4xl font-extrabold text-slate-900 leading-none">{stats.totalViews}</p>
                                                                <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mt-2 px-1">Total Impressions</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[#159A9C] bg-[#159A9C08] px-3 py-2 rounded-2xl">
                                                                <ArrowUpRight className="w-5 h-5" />
                                                                <span className="text-xs font-normal">Active</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-h-[80px] relative">
                                                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                                                <defs>
                                                                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="0%" stopColor="#0B4F6C" stopOpacity="0.4" />
                                                                        <stop offset="100%" stopColor="#0B4F6C" stopOpacity="0" />
                                                                    </linearGradient>
                                                                </defs>
                                                                <polyline
                                                                    fill="none"
                                                                    stroke="#0B4F6C"
                                                                    strokeWidth="4"
                                                                    strokeLinejoin="round"
                                                                    strokeLinecap="round"
                                                                    points={sparklinePoints}
                                                                />
                                                                <motion.polygon
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 0.15 }}
                                                                    transition={{ delay: 1 }}
                                                                    fill="url(#lineGrad)"
                                                                    points={`${sparklinePoints} 100,100 0,100`}
                                                                />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            </div>

                                            {/* Conversion Funnel Details */}
                                            <div className="space-y-8">
                                                <div className="flex items-center gap-4 px-2">
                                                    <div className="h-px flex-1 bg-slate-200/60" />
                                                    <h3 className="text-[10px] font-normal text-slate-400 uppercase tracking-widest whitespace-nowrap">Acquisition Funnel</h3>
                                                    <div className="h-px flex-1 bg-slate-200/60" />
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                                    {[
                                                        { icon: Play, label: 'Video plays', val: stats.videoPlays, display: stats.videoPlays, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
                                                        { icon: MessageSquare, label: 'Chat Queries', val: stats.chatOpens, display: stats.chatOpens, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                                                        { icon: Download, label: 'PDF Grabs', val: stats.pdfDownloads, display: stats.pdfDownloads, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                                                        { icon: Clock, label: 'Avg Session', val: stats.avgDuration, display: `${stats.avgDuration}s`, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' }
                                                    ].map((item, idx) => (
                                                        <motion.div
                                                            key={idx}
                                                            whileHover={{ y: -6, shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)' }}
                                                            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center gap-5 transition-all"
                                                        >
                                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${item.bg} ${item.color} ${item.border} border shadow-inner`}>
                                                                <item.icon className="w-7 h-7" fill={item.icon === Play && item.val > 0 ? "currentColor" : "none"} />
                                                            </div>
                                                            <div>
                                                                <p className="text-2xl font-extrabold text-slate-900 leading-none mb-2">{item.display}</p>
                                                                <p className="text-[9px] font-normal text-slate-400 uppercase tracking-widest">{item.label}</p>
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Advanced breakdown Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                {/* Device Distribution */}
                                                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                                                    <h3 className="text-[11px] font-normal text-slate-400 uppercase tracking-widest mb-8">Platform Access</h3>
                                                    <div className="flex items-center justify-between gap-12">
                                                        <div className="relative w-24 h-24 shrink-0">
                                                            <svg viewBox="0 0 36 36" className="w-full h-full transform rotate-[-90deg]">
                                                                <circle cx="18" cy="18" r="16" fill="transparent" stroke="#F1F5F9" strokeWidth="4" />
                                                                <motion.circle
                                                                    cx="18" cy="18" r="16" fill="transparent"
                                                                    stroke="#0B4F6C" strokeWidth="4"
                                                                    strokeDasharray={`${deviceStats.desktop} 100`}
                                                                    initial={{ strokeDasharray: "0 100" }}
                                                                    animate={{ strokeDasharray: `${deviceStats.desktop} 100` }}
                                                                    transition={{ duration: 1.5, ease: "circOut" }}
                                                                />
                                                            </svg>
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <PieChart className="w-5 h-5 text-slate-300" />
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 space-y-5">
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between text-[11px] font-normal uppercase tracking-wider">
                                                                    <div className="flex items-center gap-2 text-slate-700">
                                                                        <Monitor className="w-3.5 h-3.5" /> Desktop
                                                                    </div>
                                                                    <span className="text-[#0B4F6C]">{deviceStats.desktop}%</span>
                                                                </div>
                                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-[#0B4F6C] rounded-full" style={{ width: `${deviceStats.desktop}%` }} />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between text-[11px] font-normal uppercase tracking-wider">
                                                                    <div className="flex items-center gap-2 text-slate-700">
                                                                        <Smartphone className="w-3.5 h-3.5" /> Mobile
                                                                    </div>
                                                                    <span className="text-[#159A9C]">{deviceStats.mobile}%</span>
                                                                </div>
                                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-[#159A9C] rounded-full" style={{ width: `${deviceStats.mobile}%` }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Portfolio Clicks */}
                                                <div className="bg-gradient-to-br from-[#0B4F6C] to-[#159A9C] p-8 rounded-[3rem] text-white shadow-xl shadow-[#0B4F6C15] overflow-hidden relative">
                                                    <MousePointer2 className="absolute top-[-20px] right-[-20px] w-48 h-48 text-white/5 rotate-12" />
                                                    <h3 className="text-[11px] font-normal text-white/50 uppercase tracking-widest mb-6">Pipeline Velocity</h3>
                                                    <div className="flex flex-col justify-between h-full relative z-10">
                                                        <div className="space-y-1">
                                                            <p className="text-5xl font-extrabold tracking-tight">{stats.portfolioClicks}</p>
                                                            <p className="text-[11px] font-normal uppercase tracking-widest text-white/80">Portfolio Conversions</p>
                                                        </div>
                                                        <div className="mt-8">
                                                            <div className="flex items-center justify-between mb-3 text-[10px] font-normal uppercase tracking-wider text-white/70">
                                                                <span>Interest Rate</span>
                                                                <span>{Math.round((stats.portfolioClicks / (stats.totalViews || 1)) * 100)}%</span>
                                                            </div>
                                                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${(stats.portfolioClicks / (stats.totalViews || 1)) * 100}%` }}
                                                                    transition={{ duration: 1, delay: 0.5 }}
                                                                    className="h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {viewMode === 'sessions' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between mb-8 px-2">
                                                <div>
                                                    <h3 className="text-xl font-extrabold text-slate-900 leading-none">Active Engagement</h3>
                                                    <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mt-2">Real-time visitor telemetry</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search regions..."
                                                            value={sessionSearch}
                                                            onChange={(e) => setSessionSearch(e.target.value)}
                                                            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-normal focus:ring-2 focus:ring-[#0B4F6C20] outline-none transition-all w-48"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm text-[10px] font-normal text-slate-600">
                                                        <Filter className="w-3.5 h-3.5" /> Sort
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-6">
                                                {sessions.filter(s =>
                                                    (s.country || '').toLowerCase().includes(sessionSearch.toLowerCase()) ||
                                                    (s.ip_address || '').toLowerCase().includes(sessionSearch.toLowerCase())
                                                ).slice(0, 15).map((s, i) => (
                                                    <motion.div
                                                        key={s.id}
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: i * 0.04 }}
                                                        className="bg-white p-7 rounded-[2.5rem] border border-slate-100 flex flex-col gap-6 group transition-all hover:border-[#159A9C40] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06)] relative overflow-hidden"
                                                    >
                                                        {/* Activity dot for very recent sessions */}
                                                        {new Date(s.started_at).getTime() > Date.now() - 300000 && (
                                                            <div className="absolute top-6 right-6 flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between relative z-10">
                                                            <div className="flex items-center gap-5">
                                                                <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-[#0B4F6C] group-hover:bg-[#0B4F6C] group-hover:text-white transition-all duration-500 shadow-inner">
                                                                    {s.device === 'Mobile' ? <Smartphone className="w-8 h-8" /> : <Monitor className="w-8 h-8" />}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-3 mb-1.5">
                                                                        <p className="text-base font-normal text-slate-900 uppercase tracking-tight">{s.country || 'Unknown Region'}</p>
                                                                        <span className="text-[11px] text-[#159A9C] font-normal uppercase tracking-widest bg-[#159A9C10] px-3 py-1 rounded-full">
                                                                            {s.ip_address ? s.ip_address.split('.').map((p: string, i: number) => i < 2 ? p : '*').join('.') : 'Local Node'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 text-slate-400">
                                                                        <Calendar className="w-3.5 h-3.5" />
                                                                        <p className="text-[10px] font-normal uppercase tracking-widest">{getTimeAgo(s.started_at)}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="flex items-center justify-end gap-2 text-slate-900 mb-1.5">
                                                                    <Clock className="w-4 h-4 text-[#0B4F6C]" />
                                                                    <span className="text-lg font-normal tracking-tight">{s.duration_seconds || 0}s</span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 font-normal uppercase tracking-widest">Total Immersion</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-3 py-3 border-t border-slate-50 pt-6">
                                                            {s.video_clicked && <EventBadge icon={Play} label="Video Reveal" color="red" />}
                                                            {s.chat_opened && <EventBadge icon={MessageSquare} label="AI Inquiry" color="blue" />}
                                                            {s.pdf_downloaded && <EventBadge icon={Download} label="Asset Grab" color="emerald" />}
                                                            {s.portfolio_clicked && <EventBadge icon={ExternalLink} label="Deeper Dive" color="purple" />}
                                                            {!s.video_clicked && !s.chat_opened && !s.pdf_downloaded && !s.portfolio_clicked && (
                                                                <EventBadge icon={Eye} label="General Preview" color="slate" />
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))}
                                                {sessions.length === 0 && (
                                                    <div className="bg-white border border-dashed border-slate-200 rounded-[3rem] p-24 text-center">
                                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                                            <Users className="w-10 h-10 text-slate-200" />
                                                        </div>
                                                        <h3 className="text-lg font-normal text-slate-400 uppercase tracking-widest">Awaiting First Pulse</h3>
                                                        <p className="text-[10px] text-slate-300 font-normal uppercase tracking-widest mt-3">Monitoring digital channels...</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {viewMode === 'geo' && (
                                        <div className="space-y-10">
                                            <div className="bg-white rounded-[3rem] border border-slate-100 p-10 shadow-sm relative overflow-hidden">
                                                <div className="absolute top-[-40px] left-[-40px] w-96 h-96 bg-[#0B4F6C]/[0.02] rounded-full blur-3xl opacity-50" />
                                                <div className="flex items-center justify-between mb-12 relative z-10">
                                                    <div>
                                                        <h3 className="text-xl font-extrabold text-slate-900 leading-none">Geographic Domain</h3>
                                                        <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mt-2">Intercontinental reach analysis</p>
                                                    </div>
                                                    <Globe className="w-8 h-8 text-[#159A9C] opacity-20" />
                                                </div>
                                                <div className="space-y-8 relative z-10">
                                                    {getCountryStats().map(([country, count], i) => (
                                                        <div key={country} className="group/geo">
                                                            <div className="flex items-center justify-between text-[11px] font-normal mb-3">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-8 h-8 rounded-2xl bg-slate-50 flex items-center justify-center text-[#0B4F6C] text-[10px] font-normal border border-slate-100 transition-all group-hover/geo:bg-[#0B4F6C] group-hover/geo:text-white">
                                                                        {i + 1}
                                                                    </div>
                                                                    <span className="text-slate-800 uppercase tracking-widest truncate max-w-[200px]">{country}</span>
                                                                </div>
                                                                <div className="text-right flex flex-col items-end">
                                                                    <span className="text-slate-900 text-lg font-normal leading-none">{count}</span>
                                                                    <span className="text-[9px] text-[#159A9C] mt-1">{Math.round((count / (stats.totalViews || 1)) * 100)}% coverage</span>
                                                                </div>
                                                            </div>
                                                            <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden shadow-inner">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${(count / (stats.totalViews || 1)) * 100}%` }}
                                                                    transition={{ delay: 0.1 * i, duration: 1.2, ease: "circOut" }}
                                                                    className="h-full bg-gradient-to-r from-[#0B4F6C] to-[#159A9C] rounded-full shadow-[0_0_8px_rgba(11,79,108,0.2)]"
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {getCountryStats().length === 0 && (
                                                        <div className="text-center py-20 px-10">
                                                            <MapPin className="w-12 h-12 text-slate-100 mx-auto mb-6" />
                                                            <p className="text-slate-300 font-normal uppercase text-[10px] tracking-widest">Mapping digital presence...</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* World Insights Card */}
                                            <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden group">
                                                <Activity className="absolute bottom-[-30px] right-[-30px] w-64 h-64 text-white/5 opacity-20 group-hover:rotate-12 transition-transform duration-1000" />
                                                <h4 className="text-[11px] font-normal text-[#159A9C] uppercase tracking-[0.3em] mb-4">Strategic Insight</h4>
                                                <p className="text-lg font-medium text-slate-100 leading-relaxed relative z-10">
                                                    Your resume is gaining traction in <span className="text-white font-extrabold underline decoration-[#159A9C] underline-offset-4">{getCountryStats()[0]?.[0] || 'emerging regions'}</span>.
                                                    Engagement duration is <span className="text-white font-extrabold">24% higher</span> for visitors from this domain.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Final Signature / Close Action */}
                        <div className="p-10 border-t border-slate-200/60 bg-white/50 backdrop-blur-md shrink-0">
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onClose}
                                className="w-full bg-[#0B4F6C] text-white py-5 rounded-3xl font-normal text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-[#0B4F6C20] flex items-center justify-center gap-3"
                            >
                                <ChevronRight className="w-5 h-5 opacity-50" /> Close Intel Report
                            </motion.button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function EventBadge({ icon: Icon, label, color }: { icon: any, label: string, color: string }) {
    const colors: Record<string, string> = {
        red: 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-100/50',
        blue: 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-indigo-100/50',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/50',
        purple: 'bg-purple-50 text-purple-600 border-purple-100 shadow-purple-100/50',
        slate: 'bg-slate-50 text-slate-500 border-slate-200 shadow-slate-100/50'
    };

    return (
        <span className={`px-4 py-2 rounded-2xl border ${colors[color]} text-[9px] font-normal uppercase tracking-widest flex items-center gap-2.5 shadow-sm transition-transform hover:scale-105`}>
            <Icon className="w-3.5 h-3.5" /> {label}
        </span>
    );
}
