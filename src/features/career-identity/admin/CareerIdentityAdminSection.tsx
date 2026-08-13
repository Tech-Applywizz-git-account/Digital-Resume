import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { Loader2, Eye, Clock, CheckCircle, RefreshCw, Sparkles, Send, AlertCircle, ExternalLink } from 'lucide-react';
import { apiUrl } from '../../../lib/apiBase';

interface CIRequest {
    userId: string;
    email: string;
    fullName: string | null;
    workflowStatus: string;
    status: string;
    themeId: string | null;
    submissionDate: string | null;
    createdAt: string;
    updatedAt: string;
    assets: {
        resumeUrl: string | null;
        introVideoUrl: string | null;
        resumeId: string | null;
    };
}

type FilterTab = 'all' | 'submitted' | 'in_progress' | 'ready_for_review' | 'published';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'submitted', label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'ready_for_review', label: 'Ready for Review' },
    { key: 'published', label: 'Published' },
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
    const [requests, setRequests] = useState<CIRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
    const [error, setError] = useState<string | null>(null);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setError('Not authenticated');
                setLoading(false);
                return;
            }

            const params = new URLSearchParams();
            if (activeFilter !== 'all') {
                if (activeFilter === 'published') {
                    params.set('status', 'published');
                } else {
                    params.set('workflowStatus', activeFilter);
                }
            }

            const url = apiUrl(`/api/v1/career-identity/admin/requests${params.toString() ? `?${params.toString()}` : ''}`);
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.message || `Failed to fetch (${res.status})`);
            }

            const body = await res.json();
            setRequests(body.data || []);
        } catch (err: any) {
            console.error('[CareerIdentityAdmin] Failed to fetch requests:', err);
            setError(err?.message || 'Failed to load requests');
        } finally {
            setLoading(false);
        }
    }, [activeFilter]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

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
                    onClick={fetchRequests}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-slate-200 pb-3">
                {FILTER_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveFilter(tab.key)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeFilter === tab.key
                            ? 'bg-[#0B4F6C] text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

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
                                {requests.map((req) => (
                                    <tr key={req.userId} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-4">
                                            <span className="font-medium text-slate-900">
                                                {req.fullName || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-600">{req.email}</td>
                                        <td className="py-3 px-4">{getWorkflowBadge(req.workflowStatus)}</td>
                                        <td className="py-3 px-4">{getPublishBadge(req.status)}</td>
                                        <td className="py-3 px-4 text-slate-600 capitalize">{req.themeId || '—'}</td>
                                        <td className="py-3 px-4 text-slate-500 text-xs">{formatDate(req.submissionDate)}</td>
                                        <td className="py-3 px-4 text-slate-500 text-xs">{formatDate(req.updatedAt)}</td>
                                        <td className="py-3 px-4 text-center">
                                            <button
                                                onClick={() => navigate(`/career-identity-admin/request/${req.userId}`)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B4F6C] text-white rounded-lg text-xs font-medium hover:bg-[#0a3d54] transition-colors"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                Open
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}