import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { Loader2, Eye, Clock, CheckCircle, RefreshCw, Sparkles, Send, AlertCircle, ExternalLink, Copy, Check } from 'lucide-react';
import { apiUrl } from '../../../lib/apiBase';

interface CIRequest {
    userId: string;
    submissionId?: string;
    email: string;
    fullName: string | null;
    workflowStatus: string;
    status: string;
    themeId: string | null;
    submissionDate: string | null;
    createdAt: string;
    updatedAt: string;
    clarityStatus?: string;
    clarityClientConsent?: boolean;
    assets: {
        resumeUrl: string | null;
        introVideoUrl: string | null;
        resumeId: string | null;
    };
}

type FilterTab = 'all' | 'not_submitted' | 'submitted' | 'in_progress' | 'ready_for_review' | 'published' | 'clarity_pending' | 'clarity_active';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'not_submitted', label: 'Not Submitted' },
    { key: 'submitted', label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'ready_for_review', label: 'Ready for Review' },
    { key: 'published', label: 'Published' },
    { key: 'clarity_pending', label: '⚡ Clarity Setup Needed' },
    { key: 'clarity_active', label: '🎥 Clarity Live' },
];

const WORKFLOW_BADGES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    not_submitted: { bg: 'bg-gray-100', text: 'text-gray-600', icon: <Clock className="w-3 h-3" /> },
    submitted: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Send className="w-3 h-3" /> },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <RefreshCw className="w-3 h-3" /> },
    ready_for_review: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Eye className="w-3 h-3" /> },
    changes_requested: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertCircle className="w-3 h-3" /> },
    published: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle className="w-3 h-3" /> },
};

const PUBLISH_BADGES: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-600' },
    published: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

/**
 * CareerIdentityAdminSection
 * ------------------------------------------------------------------
 * Displays a queue of Career Identity requests inside the CRM.
 * Supports filtering by workflowStatus and status.
 */
export default function CareerIdentityAdminSection() {
    const navigate = useNavigate();
    const [refreshCount, setRefreshCount] = useState(0);
    const [requests, setRequests] = useState<CIRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [pendingClarityCount, setPendingClarityCount] = useState<number | null>(null);

    const handleCopyCastId = (castId: string) => {
        navigator.clipboard.writeText(castId);
        setCopiedId(castId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const fetchClarityCount = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;
            const res = await fetch(apiUrl('/api/v1/career-identity/admin/requests?clarityStatus=pending'), {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
                const body = await res.json();
                setPendingClarityCount(body.data?.length || 0);
            }
        } catch {
            // non-fatal
        }
    }, []);

    const fetchRequests = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (signal?.aborted) return;
            if (!session?.access_token) {
                setError('Not authenticated');
                setLoading(false);
                return;
            }

            const params = new URLSearchParams();
            if (activeFilter !== 'all') {
                if (activeFilter === 'published') {
                    params.set('status', 'published');
                } else if (activeFilter === 'clarity_pending') {
                    params.set('clarityStatus', 'pending');
                } else if (activeFilter === 'clarity_active') {
                    params.set('clarityStatus', 'active');
                } else {
                    params.set('workflowStatus', activeFilter);
                }
            }

            const url = apiUrl(`/api/v1/career-identity/admin/requests${params.toString() ? `?${params.toString()}` : ''}`);
            const res = await fetch(url, {
                signal,
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.message || `Failed to fetch (${res.status})`);
            }

            const body = await res.json();
            const data: CIRequest[] = body.data || [];
            if (signal?.aborted) return;
            setRequests(data);

            if (activeFilter === 'all') {
                const count = data.filter(r => r.clarityStatus === 'pending').length;
                setPendingClarityCount(count);
            } else if (activeFilter === 'clarity_pending') {
                setPendingClarityCount(data.length);
            }
        } catch (err: any) {
            if (signal?.aborted) return;
            console.error('[CareerIdentityAdmin] Failed to fetch requests:', err);
            setError(err?.message || 'Failed to load requests');
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [activeFilter]);

    useEffect(() => {
        const controller = new AbortController();
        fetchRequests(controller.signal);
        return () => controller.abort();
    }, [fetchRequests, refreshCount]);

    const totalPages = itemsPerPage === 'all' ? 1 : Math.max(1, Math.ceil(requests.length / itemsPerPage));
    const page = Math.min(currentPage, totalPages);
    const visibleRequests = itemsPerPage === 'all'
        ? requests
        : requests.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    useEffect(() => {
        setCurrentPage(previous => Math.min(previous, totalPages));
    }, [totalPages]);

    useEffect(() => {
        fetchClarityCount();
    }, [fetchClarityCount]);

    const formatDate = (date: string | null) => {
        if (!date) return '—';
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getWorkflowBadge = (status: string) => {
        const badge = WORKFLOW_BADGES[status] || WORKFLOW_BADGES.not_submitted;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${badge.bg} ${badge.text}`}>
                {badge.icon}
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    const getPublishBadge = (status: string) => {
        const badge = PUBLISH_BADGES[status] || PUBLISH_BADGES.draft;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${badge.bg} ${badge.text}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Career Identity Management
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Manage Career Identity requests from submission to publication.
                    </p>
                </div>
                <button
                    onClick={() => setRefreshCount(count => count + 1)}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
                {FILTER_TABS.map((tab) => {
                    const isClarityPending = tab.key === 'clarity_pending';
                    const isClarityActive = tab.key === 'clarity_active';
                    const isSelected = activeFilter === tab.key;

                    let tabClass = 'text-slate-600 hover:bg-slate-100';
                    if (isSelected) {
                        tabClass = isClarityPending
                            ? 'bg-amber-600 text-white shadow-sm'
                            : isClarityActive
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-[#0B4F6C] text-white';
                    } else if (isClarityPending) {
                        tabClass = 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80';
                    }

                    return (
                        <button
                            key={tab.key}
                            onClick={() => {
                                if (isSelected) return;
                                setCurrentPage(1);
                                setLoading(true);
                                setActiveFilter(tab.key);
                            }}
                            className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${tabClass}`}
                        >
                            <span>{tab.label}</span>
                            {isClarityPending && pendingClarityCount !== null && pendingClarityCount > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    isSelected ? 'bg-white text-amber-800' : 'bg-amber-200 text-amber-900'
                                }`}>
                                    {pendingClarityCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {!loading && !error && requests.length > 0 && (
                <div className="flex justify-end">
                    <label className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Show</span>
                        <select value={itemsPerPage} onChange={event => {
                            const value = event.target.value;
                            setItemsPerPage(value === 'all' ? 'all' : Number(value));
                            setCurrentPage(1);
                        }} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-[#0B4F6C]/10">
                            {[10, 30, 50, 100, 200, 300, 500, 1000].map(size => (
                                <option key={size} value={size}>{size} per page</option>
                            ))}
                            <option value="all">All records</option>
                        </select>
                    </label>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin h-8 w-8 text-[#0B4F6C]" />
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && requests.length === 0 && (
                <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                        <Sparkles className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">No requests found</h3>
                    <p className="text-sm text-slate-500">
                        {activeFilter === 'all'
                            ? 'No Career Identity requests have been submitted yet.'
                            : activeFilter === 'not_submitted'
                            ? 'All Career Identity clients have submitted a request.'
                            : activeFilter === 'clarity_pending'
                            ? 'No clients are currently waiting for Microsoft Clarity project setup.'
                            : activeFilter === 'clarity_active'
                            ? 'No clients currently have active Microsoft Clarity projects.'
                            : `No requests with status "${activeFilter.replace(/_/g, ' ')}".`}
                    </p>
                </div>
            )}

            {/* Requests Table */}
            {!loading && !error && requests.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Candidate</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Email</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Workflow</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Publish</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Theme</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Submitted</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Updated</th>
                                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {visibleRequests.map((req) => (
                                    <tr key={req.userId} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-900">
                                                    {req.fullName || 'Unknown'}
                                                </span>
                                                {req.clarityStatus === 'active' && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Clarity Live">
                                                        🎥 Live
                                                    </span>
                                                )}
                                                {req.clarityStatus === 'pending' && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Client opted in, awaiting setup">
                                                        🎥 Opted-In
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-slate-600">{req.email}</td>
                                        <td className="py-3 px-4">{getWorkflowBadge(req.workflowStatus)}</td>
                                        <td className="py-3 px-4">{getPublishBadge(req.status)}</td>
                                        <td className="py-3 px-4">
                                            {req.themeId ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
                                                    style={{
                                                        backgroundColor: req.themeId === 'zenith' ? '#f0fdfa' : req.themeId === 'atlas' ? '#fff1f2' : '#eff6ff',
                                                        borderColor: req.themeId === 'zenith' ? '#ccfbf1' : req.themeId === 'atlas' ? '#ffe4e6' : '#dbeafe',
                                                        color: req.themeId === 'zenith' ? '#0f766e' : req.themeId === 'atlas' ? '#881337' : '#1d4ed8'
                                                    }}
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full"
                                                        style={{
                                                            backgroundColor: req.themeId === 'zenith' ? '#0f766e' : req.themeId === 'atlas' ? '#881337' : '#2563eb'
                                                        }}
                                                    />
                                                    <span className="capitalize">{req.themeId}</span>
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-slate-500 text-xs">{formatDate(req.submissionDate)}</td>
                                        <td className="py-3 px-4 text-slate-500 text-xs">{formatDate(req.updatedAt)}</td>
                                        <td className="py-3 px-4 text-center">
                                            {(req.workflowStatus !== 'not_submitted' || req.status === 'published') && <div className="inline-flex items-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/career-identity-admin/request/${req.userId}${req.submissionId ? `?submissionId=${req.submissionId}` : ''}`)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B4F6C] text-white rounded-lg text-xs font-medium hover:bg-[#0a3d54] transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Open
                                                </button>

                                                {req.assets?.resumeId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyCastId(req.assets.resumeId!)}
                                                        title={`Copy Cast ID: ${req.assets.resumeId}`}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        {copiedId === req.assets.resumeId ? (
                                                            <>
                                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                                <span className="text-emerald-600">Copied</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                                                                <span>Copy ID</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <nav aria-label="Career Identity pagination" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                            <p className="text-xs font-medium text-slate-500" aria-live="polite">
                                Showing page <span className="font-bold text-slate-900">{page}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setCurrentPage(page - 1)} disabled={page === 1}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                                    Previous
                                </button>
                                <button type="button" onClick={() => setCurrentPage(page + 1)} disabled={page === totalPages}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                                    Next
                                </button>
                            </div>
                        </nav>
                    )}
                </div>
            )}
        </div>
    );
}
