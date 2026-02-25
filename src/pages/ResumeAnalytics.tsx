import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import {
    BarChart3,
    MapPin,
    Smartphone,
    Monitor,
    Download,
    MessageSquare,
    Play,
    ArrowLeft,
    Calendar,
    Layers,
    Users,
    Eye,
    Activity,
    ChevronRight,
    Loader2,
    ExternalLink,
    Globe
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SessionData {
    id: string;
    created_at: string;
    session_id: string;
    ip_address: string;
    country: string;
    device: string;
    video_clicked: boolean;
    chat_opened: boolean;
    portfolio_clicked: boolean;
    pdf_downloaded: boolean;
    duration_seconds: number;
    started_at: string;
}

interface EventData {
    id: string;
    created_at: string;
    event_type: string;
    country: string;
    source: string;
}

export default function ResumeAnalytics() {
    const { castId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [events, setEvents] = useState<EventData[]>([]);
    const [resumeTitle, setResumeTitle] = useState('Resume Analytics');
    const [timeRange, setTimeRange] = useState('all'); // '7d', '30d', 'all'

    // Summary Stats
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
        if (castId) {
            fetchAnalytics();
            fetchResumeInfo();
        }
    }, [castId, timeRange]);

    const fetchResumeInfo = async () => {
        // Try both tables
        const [crmJob, regularJob] = await Promise.all([
            supabase.from('crm_job_requests').select('job_title').eq('id', castId).maybeSingle(),
            supabase.from('job_requests').select('job_title').eq('id', castId).maybeSingle()
        ]);
        const title = crmJob.data?.job_title || regularJob.data?.job_title || 'Resume Analytics';
        setResumeTitle(title);
    };

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // 1. Fetch Sessions
            let sessionQuery = supabase
                .from('resume_sessions')
                .select('*')
                .eq('resume_id', castId)
                .order('started_at', { ascending: false });

            // Apply time filter (simplistic for now)
            if (timeRange === '7d') {
                const date = new Date();
                date.setDate(date.getDate() - 7);
                sessionQuery = sessionQuery.gte('started_at', date.toISOString());
            } else if (timeRange === '30d') {
                const date = new Date();
                date.setDate(date.getDate() - 30);
                sessionQuery = sessionQuery.gte('started_at', date.toISOString());
            }

            const { data: sessionData, error: sError } = await sessionQuery;
            if (sError) throw sError;

            // 2. Fetch Click Events (Individual actions)
            let clickQuery = supabase
                .from('resume_click_tracking')
                .select('*')
                .eq('resume_id', castId)
                .order('created_at', { ascending: false });

            if (timeRange === '7d') {
                const date = new Date();
                date.setDate(date.getDate() - 7);
                clickQuery = clickQuery.gte('created_at', date.toISOString());
            }

            const { data: eventData, error: eError } = await clickQuery;
            if (eError) throw eError;

            setSessions(sessionData || []);
            setEvents(eventData || []);

            // 3. Process Stats
            const s = sessionData || [];
            const e = eventData || [];

            const uniqueIps = new Set(s.map(item => item.ip_address)).size;
            const totalDuration = s.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0);

            setStats({
                totalViews: s.length,
                uniqueVisitors: uniqueIps,
                avgDuration: s.length > 0 ? Math.round(totalDuration / s.length) : 0,
                pdfDownloads: e.filter(item => item.event_type === 'pdf_download').length,
                videoPlays: e.filter(item => item.event_type === 'play_intro').length,
                chatOpens: e.filter(item => item.event_type === 'lets_talk').length,
                portfolioClicks: e.filter(item => item.event_type === 'portfolio_click').length
            });

        } catch (err) {
            console.error('Error fetching analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ title, value, icon: Icon, color, subValue }: any) => (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1"
        >
            <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl ${color} bg-opacity-10 text-slate-600`}>
                    <Icon className="w-5 h-5" />
                </div>
                {subValue && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{subValue}</span>}
            </div>
            <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{title}</h3>
            <p className="text-2xl font-black text-slate-900">{value}</p>
        </motion.div>
    );

    const getCountryStats = () => {
        const map: Record<string, number> = {};
        sessions.forEach(s => {
            const c = s.country || 'Unknown';
            map[c] = (map[c] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    };

    const getDeviceStats = () => {
        const map: Record<string, number> = { Mobile: 0, Desktop: 0, Unknown: 0 };
        sessions.forEach(s => {
            const d = s.device || 'Unknown';
            map[d] = (map[d] || 0) + 1;
        });
        return map;
    };

    if (loading) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 text-[#0B4F6C] animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Crunching your analytics data...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20 font-['-apple-system',_BlinkMacSystemFont,_'Segoe_UI',_Roboto,_Helvetica,_Arial,_sans-serif]">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-slate-900"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 line-clamp-1">{resumeTitle}</h1>
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                <BarChart3 className="w-3 h-3" />
                                <span>Performance Insights</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {['all', '30d', '7d'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === range
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {range === 'all' ? 'All Time' : range === '30d' ? '30 Days' : '7 Days'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 pt-8">
                {/* Top Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        title="Total Sessions"
                        value={stats.totalViews}
                        icon={Users}
                        color="bg-blue-500"
                        subValue="Reach"
                    />
                    <StatCard
                        title="Uniq Visitors"
                        value={stats.uniqueVisitors}
                        icon={Eye}
                        color="bg-emerald-500"
                        subValue="Reach"
                    />
                    <StatCard
                        title="Avg. Duration"
                        value={`${stats.avgDuration}s`}
                        icon={Activity}
                        color="bg-orange-500"
                        subValue="Engage"
                    />
                    <StatCard
                        title="Conv. Rate"
                        value={`${stats.totalViews > 0 ? Math.round(((stats.pdfDownloads + stats.chatOpens) / stats.totalViews) * 100) : 0}%`}
                        icon={Globe}
                        color="bg-purple-500"
                        subValue="Success"
                    />
                </div>

                {/* Action Breakdown & Location */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Action Cards */}
                    <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                                <Play className="w-6 h-6" fill="currentColor" />
                            </div>
                            <p className="text-2xl font-black text-slate-900">{stats.videoPlays}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Video Plays</p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <p className="text-2xl font-black text-slate-900">{stats.chatOpens}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chat Opens</p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                                <Download className="w-6 h-6" />
                            </div>
                            <p className="text-2xl font-black text-slate-900">{stats.pdfDownloads}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PDF Downloads</p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                                <ExternalLink className="w-6 h-6" />
                            </div>
                            <p className="text-2xl font-black text-slate-900">{stats.portfolioClicks}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portfl. Clicks</p>
                        </div>
                    </div>

                    {/* Demographics Card */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#0B4F6C]" /> Top Locations
                        </h3>
                        <div className="space-y-4">
                            {getCountryStats().length > 0 ? getCountryStats().map(([country, count]) => (
                                <div key={country} className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-slate-600">{country}</span>
                                        <span className="text-slate-900">{count} views</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(count / stats.totalViews) * 100}%` }}
                                            className="h-full bg-[#0B4F6C]"
                                        />
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-4 text-slate-400 text-xs italic">No location data yet</div>
                            )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Monitor className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-bold text-slate-600">Desktop</span>
                            </div>
                            <span className="text-xs font-black text-slate-900">{getDeviceStats().Desktop}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Smartphone className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-bold text-slate-600">Mobile</span>
                            </div>
                            <span className="text-xs font-black text-slate-900">{getDeviceStats().Mobile}</span>
                        </div>
                    </div>
                </div>

                {/* Detailed Logs */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-[#0B4F6C]" /> Recent Interactions
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Device</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions Captured</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stay Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {sessions.length > 0 ? sessions.map(session => (
                                    <tr key={session.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-800">
                                                    {new Date(session.started_at).toLocaleDateString()}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                                                    {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-slate-600">{session.country || 'Unknown'}</span>
                                                <span className="text-[10px] text-slate-300 font-mono">{session.ip_address}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-500">
                                                {session.device === 'Mobile' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                                                <span className="text-[11px] font-medium">{session.device}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">Page View</span>
                                                {session.video_clicked && (
                                                    <span className="px-2 py-0.5 rounded bg-red-50 text-[10px] font-bold text-red-600 uppercase">Video Play</span>
                                                )}
                                                {session.chat_opened && (
                                                    <span className="px-2 py-0.5 rounded bg-blue-50 text-[10px] font-bold text-blue-600 uppercase">Chat Opened</span>
                                                )}
                                                {session.pdf_downloaded && (
                                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600 uppercase">PDF Save</span>
                                                )}
                                                {session.portfolio_clicked && (
                                                    <span className="px-2 py-0.5 rounded bg-purple-50 text-[10px] font-bold text-purple-600 uppercase">Portfolio</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-black text-slate-900">{session.duration_seconds || 0}s</span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <div className="max-w-xs mx-auto flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                                                    <Activity className="w-8 h-8 text-slate-200" />
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-800">No session data available</h4>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    Analytics will appear here once visitors start viewing your digital resume.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
