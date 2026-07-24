import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import {
    Loader2, ArrowLeft, Eye, Clock, CheckCircle, RefreshCw, Sparkles,
    Send, AlertCircle, ExternalLink, Play, FileText, User, Mail, Calendar,
    Tag, Shield, Video, Download, Edit3, Wallet, FileText as FilePdf
} from 'lucide-react';
import CareerIdentityAdminEditor from './CareerIdentityAdminEditor';
import type { CareerIdentityContent, CareerIdentityProfileStatus } from '../../../types/careerIdentity';

interface RequestDetail {
    userId: string;
    email: string;
    fullName: string | null;
    tier: string;
    workflowStatus: string;
    status: string;
    themeId: string | null;
    content: Record<string, unknown>;
    submissionDate: string | null;
    createdAt: string;
    updatedAt: string;
    assets: {
        resumeUrl: string | null;
        introVideoUrl: string | null;
        recordingCreatedAt: string | null;
        resumeId: string | null;
        jobTitle: string | null;
        jobDescription: string | null;
    };
}

const WORKFLOW_BADGES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    not_submitted: { bg: 'bg-gray-100', text: 'text-gray-600', icon: <Clock className="w-3.5 h-3.5" /> },
    submitted: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Send className="w-3.5 h-3.5" /> },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <RefreshCw className="w-3.5 h-3.5" /> },
    ready_for_review: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Eye className="w-3.5 h-3.5" /> },
    changes_requested: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertCircle className="w-3.5 h-3.5" /> },
    published: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle className="w-3.5 h-3.5" /> },
};

/**
 * CareerIdentityAdminRequestDetail
 * ------------------------------------------------------------------
 * Request details page for the CRM admin. Shows candidate information,
 * resume preview, intro video, and workflow controls.
 * This is NOT the editor — it's a review workspace.
 */
export default function CareerIdentityAdminRequestDetail() {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    const fetchRequest = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setError('Not authenticated');
                setLoading(false);
                return;
            }

            const res = await fetch(`/api/v1/career-identity/admin/requests/${userId}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.message || `Failed to fetch (${res.status})`);
            }

            const body = await res.json();
            setRequest(body.data);
        } catch (err: any) {
            console.error('[CareerIdentityAdmin] Failed to fetch request:', err);
            setError(err?.message || 'Failed to load request');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchRequest();
    }, [fetchRequest]);

    // Populate wallet state when request data loads
    useEffect(() => {
        if (request) {
            setWalletPassUrl((request as any).walletPassUrl || '');
            setWalletCardUrl((request as any).walletCardUrl || null);
            setWalletCardUpdatedAt((request as any).walletCardUpdatedAt || null);
            const status = (request as any).walletCardStatus;
            if (status) {
                setWalletCardStatus(status as 'idle' | 'generating' | 'generated' | 'failed');
            }
            const errorMsg = (request as any).walletCardErrorMessage;
            if (errorMsg) {
                setWalletCardError(errorMsg);
            }
        }
    }, [request]);

    // Store asset URLs in localStorage so Preview can access them
    useEffect(() => {
        if (request?.assets) {
            if (request.assets.introVideoUrl) {
                localStorage.setItem('ci_preview_video_url', request.assets.introVideoUrl);
            }
            if (request.assets.resumeUrl) {
                localStorage.setItem('ci_preview_resume_url', request.assets.resumeUrl);
            }
        }
    }, [request?.assets?.introVideoUrl, request?.assets?.resumeUrl]);

    const updateWorkflow = async (workflowStatus: string) => {
        if (!userId) return;
        setUpdating(true);
        setUpdateError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const res = await fetch(`/api/v1/career-identity/admin/requests/${userId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ workflowStatus }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.message || `Failed to update (${res.status})`);
            }

            await fetchRequest();
        } catch (err: any) {
            setUpdateError(err?.message || 'Failed to update workflow');
        } finally {
            setUpdating(false);
        }
    };

    const publishProfile = async () => {
        if (!userId) return;
        setUpdating(true);
        setUpdateError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const res = await fetch(`/api/v1/career-identity/admin/requests/${userId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'published' }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.message || `Failed to publish (${res.status})`);
            }

            await fetchRequest();
        } catch (err: any) {
            setUpdateError(err?.message || 'Failed to publish');
        } finally {
            setUpdating(false);
        }
    };

    const formatDate = (date: string | null) => {
        if (!date) return '—';
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const getWorkflowBadge = (status: string) => {
        const badge = WORKFLOW_BADGES[status] || WORKFLOW_BADGES.not_submitted;
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${badge.bg} ${badge.text}`}>
                {badge.icon}
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    // ── All hooks must be declared before any conditional return ──────────
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [walletPassUrl, setWalletPassUrl] = useState('');
    const [savingWalletUrl, setSavingWalletUrl] = useState(false);
    const [walletCardStatus, setWalletCardStatus] = useState<'idle' | 'generating' | 'generated' | 'failed'>('idle');
    const [walletCardUrl, setWalletCardUrl] = useState<string | null>(null);
    const [walletCardUpdatedAt, setWalletCardUpdatedAt] = useState<string | null>(null);
    const [walletCardError, setWalletCardError] = useState<string | null>(null);
    const [regenerating, setRegenerating] = useState(false);

    const handleSave = async (data: { content: CareerIdentityContent; themeId: string; status?: CareerIdentityProfileStatus; workflowStatus?: string }) => {
        if (!userId) return;
        setSaving(true);
        setUpdateError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const body: Record<string, unknown> = {
                content: data.content,
                themeId: data.themeId,
            };
            if (data.workflowStatus) body.workflowStatus = data.workflowStatus;
            if (data.status) body.status = data.status;

            const res = await fetch(`/api/v1/career-identity/admin/requests/${userId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody?.message || `Failed to save (${res.status})`);
            }

            await fetchRequest();
            setEditing(false);
        } catch (err: any) {
            setUpdateError(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // ── Conditional returns (must be after ALL hooks) ────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="animate-spin h-10 w-10 text-[#0B4F6C]" />
            </div>
        );
    }

    if (error || !request) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">{error || 'Request not found'}</p>
                    <button
                        onClick={() => navigate('/digital-resume-dashboard')}
                        className="mt-4 px-4 py-2 bg-[#0B4F6C] text-white rounded-lg text-sm font-medium hover:bg-[#0a3d54]"
                    >
                        Back to Queue
                    </button>
                </div>
            </div>
        );
    }

    const hasContent = request.content && Object.keys(request.content).length > 0;
    const isPublished = request.status === 'published';

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/digital-resume-dashboard')}
                                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span className="text-sm font-medium">Back to Queue</span>
                            </button>
                            <div className="h-6 w-px bg-slate-200" />
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">
                                    {request.fullName || 'Unknown Candidate'}
                                </h1>
                                <div className="flex items-center gap-3 mt-1">
                                    {getWorkflowBadge(request.workflowStatus)}
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${isPublished
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        <Shield className="w-3.5 h-3.5" />
                                        {request.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Workflow Actions Bar */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-500 mr-2">Actions:</span>

                    {request.workflowStatus === 'submitted' && (
                        <button
                            onClick={() => updateWorkflow('in_progress')}
                            disabled={updating}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Accept & Start
                        </button>
                    )}

                    {request.workflowStatus === 'in_progress' && (
                        <button
                            onClick={() => updateWorkflow('ready_for_review')}
                            disabled={updating}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                            Mark Ready for Review
                        </button>
                    )}

                    {request.workflowStatus === 'ready_for_review' && (
                        <>
                            <button
                                onClick={() => updateWorkflow('changes_requested')}
                                disabled={updating}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                                Request Changes
                            </button>
                            <button
                                onClick={publishProfile}
                                disabled={updating}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Publish
                            </button>
                        </>
                    )}

                    {request.workflowStatus === 'changes_requested' && (
                        <button
                            onClick={() => updateWorkflow('in_progress')}
                            disabled={updating}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Resume Work
                        </button>
                    )}

                    {!editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0B4F6C] text-white rounded-lg text-sm font-medium hover:bg-[#0a3d54] transition-colors"
                        >
                            <Edit3 className="w-4 h-4" />
                            Edit Career Identity
                        </button>
                    )}

                    {updateError && (
                        <span className="text-sm text-red-600 flex items-center gap-1 ml-2">
                            <AlertCircle className="w-4 h-4" /> {updateError}
                        </span>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {editing ? (
                    <CareerIdentityAdminEditor
                        initialContent={request.content as CareerIdentityContent}
                        initialThemeId={request.themeId}
                        initialStatus={request.status as CareerIdentityProfileStatus}
                        resumeId={request.assets.resumeId}
                        onSave={handleSave}
                        onCancel={() => setEditing(false)}
                        saving={saving}
                        saveError={updateError}
                    />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column — Candidate Info + Resume + Video */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Candidate Information Card */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-500" />
                                    Candidate Information
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Full Name</p>
                                        <p className="text-sm font-semibold text-slate-900">{request.fullName || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Email</p>
                                        <p className="text-sm text-slate-900">{request.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">User ID</p>
                                        <p className="text-sm text-slate-600 font-mono text-xs">{request.userId}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Subscription Tier</p>
                                        <p className="text-sm font-semibold text-slate-900 capitalize">{request.tier}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Submission Date</p>
                                        <p className="text-sm text-slate-900">{formatDate(request.submissionDate)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Last Updated</p>
                                        <p className="text-sm text-slate-900">{formatDate(request.updatedAt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Theme</p>
                                        <p className="text-sm text-slate-900 capitalize">{request.themeId || 'Not assigned'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Job Title</p>
                                        <p className="text-sm text-slate-900">{request.assets.jobTitle || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Resume Preview Card */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-500" />
                                    Resume
                                </h2>
                                {request.assets.resumeUrl ? (
                                    <div className="space-y-3">
                                        <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden" style={{ height: '500px' }}>
                                            <iframe
                                                src={request.assets.resumeUrl}
                                                className="w-full h-full"
                                                title="Resume Preview"
                                            />
                                        </div>
                                        <a
                                            href={request.assets.resumeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B4F6C] text-white rounded-lg text-sm font-medium hover:bg-[#0a3d54] transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download Resume
                                        </a>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-400">
                                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-sm font-medium">No resume uploaded</p>
                                    </div>
                                )}
                            </div>

                            {/* Intro Video Card */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <Video className="w-4 h-4 text-slate-500" />
                                    Intro Video
                                </h2>
                                {request.assets.introVideoUrl ? (
                                    <div className="space-y-3">
                                        <div className="bg-black rounded-lg overflow-hidden">
                                            <video
                                                controls
                                                className="w-full h-auto"
                                                style={{ maxHeight: '400px' }}
                                                src={request.assets.introVideoUrl}
                                            >
                                                <source src={request.assets.introVideoUrl} type="video/webm" />
                                                <source src={request.assets.introVideoUrl} type="video/mp4" />
                                            </video>
                                        </div>
                                        {request.assets.recordingCreatedAt && (
                                            <p className="text-xs text-slate-500">
                                                Recorded: {formatDate(request.assets.recordingCreatedAt)}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-400">
                                        <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-sm font-medium">No intro video recorded</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column — Career Identity Summary */}
                        <div className="space-y-6">
                            {/* Career Identity Summary Card */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    Career Identity Summary
                                </h2>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium mb-1">Workflow Status</p>
                                        {getWorkflowBadge(request.workflowStatus)}
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium mb-1">Publish Status</p>
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${isPublished
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            <Shield className="w-3.5 h-3.5" />
                                            {request.status}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium mb-1">Theme</p>
                                        <p className="text-sm font-semibold text-slate-900 capitalize">
                                            {request.themeId || 'Not assigned'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium mb-1">Profile Content</p>
                                        <p className="text-sm text-slate-900">
                                            {hasContent ? 'Content exists' : 'No content yet'}
                                        </p>
                                    </div>
                                    {request.assets.jobDescription && (
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium mb-1">AI Script</p>
                                            <p className="text-sm text-slate-600 line-clamp-4">
                                                {request.assets.jobDescription}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Existing Content Preview (read-only) */}
                            {hasContent && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-slate-500" />
                                        Existing Content
                                    </h2>
                                    <div className="space-y-3 text-sm">
                                        {(request.content.about as string) && (
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">About</p>
                                                <p className="text-slate-700 mt-0.5 line-clamp-3">{request.content.about as string}</p>
                                            </div>
                                        )}
                                        {Array.isArray(request.content.experience) && (request.content.experience as any[]).length > 0 && (
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">Experience</p>
                                                <p className="text-slate-700 mt-0.5">{(request.content.experience as any[]).length} entries</p>
                                            </div>
                                        )}
                                        {Array.isArray(request.content.education) && (request.content.education as any[]).length > 0 && (
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">Education</p>
                                                <p className="text-slate-700 mt-0.5">{(request.content.education as any[]).length} entries</p>
                                            </div>
                                        )}
                                        {Array.isArray(request.content.skills) && (request.content.skills as any[]).length > 0 && (
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">Skills</p>
                                                <p className="text-slate-700 mt-0.5">{(request.content.skills as any[]).length} skills</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Apple Wallet Card ─────────────────────────────────────── */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <Wallet className="w-4 h-4 text-blue-600" />
                                    Apple Wallet
                                </h2>
                                <div className="space-y-4">
                                    {/* Wallet Card Status */}
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium mb-1">Wallet Card Status</p>
                                        <div className="flex items-center gap-2">
                                            {walletCardStatus === 'generating' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-700">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating
                                                </span>
                                            )}
                                            {walletCardStatus === 'generated' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-700">
                                                    <CheckCircle className="w-3.5 h-3.5" /> Generated
                                                </span>
                                            )}
                                            {walletCardStatus === 'failed' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700">
                                                    <AlertCircle className="w-3.5 h-3.5" /> Failed
                                                </span>
                                            )}
                                            {walletCardStatus === 'idle' && !walletCardUrl && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600">
                                                    Not yet generated
                                                </span>
                                            )}
                                            {walletCardStatus === 'idle' && walletCardUrl && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-700">
                                                    <CheckCircle className="w-3.5 h-3.5" /> Generated
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Wallet Card PDF is automatically generated when wallet-related content changes.
                                        </p>
                                    </div>

                                    {/* Preview & Download Wallet Card PDF */}
                                    <div className="flex flex-wrap gap-2">
                                        <a
                                            href={walletCardUrl ? `${walletCardUrl}${walletCardUrl.includes('?') ? '&' : '?'}_t=${Date.now()}` : '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${walletCardUrl
                                                ? 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                }`}
                                            onClick={(e) => { if (!walletCardUrl) e.preventDefault(); }}
                                        >
                                            <FilePdf className="w-4 h-4" />
                                            Preview Wallet Card PDF
                                        </a>
                                        <button
                                            disabled={!walletCardUrl}
                                            onClick={async () => {
                                                if (!walletCardUrl) return;
                                                try {
                                                    // Fetch the PDF as a Blob
                                                    const response = await fetch(walletCardUrl);
                                                    const blob = await response.blob();
                                                    const blobUrl = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = blobUrl;
                                                    a.download = `${request?.fullName?.replace(/\s+/g, '_') || 'CareerIdentity'}_WalletCard.pdf`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                    URL.revokeObjectURL(blobUrl);
                                                } catch (err) {
                                                    console.error('Failed to download wallet card:', err);
                                                }
                                            }}
                                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${walletCardUrl
                                                ? 'bg-[#0B4F6C] text-white hover:bg-[#0a3d54]'
                                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                }`}
                                        >
                                            <Download className="w-4 h-4" />
                                            Download Wallet Card PDF
                                        </button>
                                    </div>

                                    {/* Wallet Pass URL Editable Field */}
                                    <div>
                                        <label className="block text-xs text-slate-500 font-medium mb-1">
                                            Wallet Pass URL (from NeatPass)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="url"
                                                value={walletPassUrl}
                                                onChange={(e) => setWalletPassUrl(e.target.value)}
                                                placeholder="https://neatpass.com/pass/..."
                                                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none"
                                            />
                                            <button
                                                onClick={async () => {
                                                    if (!userId) return;
                                                    setSavingWalletUrl(true);
                                                    try {
                                                        const { data: { session } } = await supabase.auth.getSession();
                                                        if (!session?.access_token) throw new Error('Not authenticated');
                                                        await fetch(`/api/v1/career-identity/admin/requests/${userId}`, {
                                                            method: 'PATCH',
                                                            headers: {
                                                                Authorization: `Bearer ${session.access_token}`,
                                                                'Content-Type': 'application/json',
                                                            },
                                                            body: JSON.stringify({ walletPassUrl }),
                                                        });
                                                    } catch (err: any) {
                                                        console.error('Failed to save wallet URL:', err);
                                                    } finally {
                                                        setSavingWalletUrl(false);
                                                    }
                                                }}
                                                disabled={savingWalletUrl}
                                                className="px-4 py-2 bg-[#0B4F6C] text-white rounded-lg text-sm font-medium hover:bg-[#0a3d54] transition-colors disabled:opacity-50"
                                            >
                                                {savingWalletUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                            </button>
                                        </div>
                                    </div>

                                    {walletCardError && (
                                        <p className="text-xs text-red-500 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> {walletCardError}
                                        </p>
                                    )}

                                    {walletCardUpdatedAt && (
                                        <p className="text-xs text-slate-400">
                                            Last generated: {formatDate(walletCardUpdatedAt)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

        </div>
    );
}