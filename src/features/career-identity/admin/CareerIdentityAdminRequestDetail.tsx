import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import {
    Loader2, ArrowLeft, Eye, Clock, CheckCircle, RefreshCw, Sparkles,
    Send, AlertCircle, ExternalLink, Play, FileText, User, Mail, Calendar,
    Tag, Shield, Video, Download, Edit3, Wallet, FileText as FilePdf,
    Copy, Check
} from 'lucide-react';
import CareerIdentityAdminEditor from './CareerIdentityAdminEditor';
import type { CareerIdentityContent, CareerIdentityProfileStatus } from '../../../types/careerIdentity';
import { apiUrl } from '../../../lib/apiBase';

interface RequestDetail {
    userId: string;
    submissionId?: string;
    publicId?: string | null;
    versionNumber?: number;
    publishedAt?: string | null;
    publishedVersion?: Pick<RequestDetail, 'versionNumber' | 'publishedAt' | 'themeId' | 'content' | 'submissionDate' | 'updatedAt' | 'assets'> | null;
    comparison?: { resumeChanged: boolean; videoChanged: boolean; contentSections: string[] } | null;
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
    const [searchParams] = useSearchParams();
    const openedSubmissionId = searchParams.get('submissionId');
    const [view, setView] = useState<'pending' | 'published'>('pending');
    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [copiedCastId, setCopiedCastId] = useState(false);

    const handleCopyCastId = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedCastId(true);
        setTimeout(() => setCopiedCastId(false), 2000);
    };

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

            const res = await fetch(apiUrl(`/api/v1/career-identity/admin/requests/${userId}${openedSubmissionId ? `?submissionId=${encodeURIComponent(openedSubmissionId)}` : ''}`), {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message || body?.message || `Failed to fetch (${res.status})`);
            }

            const body = await res.json();
            setRequest(body.data);
        } catch (err: any) {
            console.error('[CareerIdentityAdmin] Failed to fetch request:', err);
            setError(err?.message || 'Failed to load request');
        } finally {
            setLoading(false);
        }
    }, [userId, openedSubmissionId]);

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

    const updateWorkflow = async (workflowStatus: string) => {
        if (!userId) return;
        setUpdating(true);
        setUpdateError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const res = await fetch(apiUrl(`/api/v1/career-identity/admin/requests/${userId}`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    ...(request?.submissionId ? { 'X-CI-Submission-Id': request.submissionId } : {}),
                },
                body: JSON.stringify({ workflowStatus }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const message = body?.error?.message || body?.message || `Failed to update (${res.status})`;
                throw new Error(body?.requestId ? `${message} Reference: ${body.requestId}` : message);
            }

            const body = await res.json();
            setRequest(body.data);
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

            const res = await fetch(apiUrl(`/api/v1/career-identity/admin/requests/${userId}`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    ...(request?.submissionId ? { 'X-CI-Submission-Id': request.submissionId } : {}),
                },
                body: JSON.stringify({ status: 'published' }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message || body?.message || `Failed to publish (${res.status})`);
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

    // Microsoft Clarity state
    const [clarityProjectId, setClarityProjectId] = useState('');
    const [clarityAccountEmail, setClarityAccountEmail] = useState('');
    const [clarityAccountType, setClarityAccountType] = useState<'company_zoho' | 'client_personal' | null>(null);
    const [clarityStatus, setClarityStatus] = useState<'disabled' | 'pending' | 'active'>('disabled');
    const [clarityClientConsent, setClarityClientConsent] = useState<{ accepted: boolean; acceptedAt: string | null; revokedAt?: string | null }>({ accepted: false, acceptedAt: null, revokedAt: null });
    const [clarityNotes, setClarityNotes] = useState('');
    const [savingClarity, setSavingClarity] = useState(false);
    const [claritySaveMessage, setClaritySaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [copiedProjectEmail, setCopiedProjectEmail] = useState(false);
    const [isEditingClarity, setIsEditingClarity] = useState(false);

    const handleCancelClarityEdit = () => {
        if (request) {
            const c = (request as any).clarity || {};
            setClarityProjectId(c.projectId || '');
            setClarityAccountEmail(c.accountEmail || '');
            setClarityAccountType(c.accountType || null);
            setClarityStatus(c.status || 'disabled');
            setClarityNotes(c.notes || '');
        }
        setIsEditingClarity(false);
    };

    useEffect(() => {
        if (request) {
            const c = (request as any).clarity || {};
            setClarityProjectId(c.projectId || '');
            setClarityAccountEmail(c.accountEmail || '');
            setClarityAccountType(c.accountType || null);
            setClarityStatus(c.status || 'disabled');
            setClarityClientConsent(c.clientConsent || { accepted: false, acceptedAt: null, revokedAt: null });
            setClarityNotes(c.notes || '');
        }
    }, [request]);

    const handleSaveClarity = async () => {
        if (!userId) return;
        setSavingClarity(true);
        setClaritySaveMessage(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const body = {
                clarity: {
                    projectId: clarityProjectId.trim() || null,
                    accountEmail: clarityAccountEmail.trim() || null,
                    accountType: clarityAccountType,
                    status: clarityStatus,
                    notes: clarityNotes.trim() || null,
                    ...(!request?.submissionId ? { clientConsent: clarityClientConsent } : {}),
                },
            };

            const res = await fetch(apiUrl(`/api/v1/career-identity/admin/requests/${userId}`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    ...(request?.submissionId ? { 'X-CI-Submission-Id': request.submissionId } : {}),
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody?.error?.message || errBody?.message || `Failed to save Clarity config (${res.status})`);
            }

            setClaritySaveMessage({ text: 'Clarity configuration saved successfully.', type: 'success' });
            setIsEditingClarity(false);
            await fetchRequest();
            setTimeout(() => setClaritySaveMessage(null), 3000);
        } catch (err: any) {
            setClaritySaveMessage({ text: err?.message || 'Failed to save Clarity configuration.', type: 'error' });
        } finally {
            setSavingClarity(false);
        }
    };

    const handleDirectConsentChange = async (newConsent: { accepted: boolean; acceptedAt: string | null; revokedAt?: string | null }) => {
        if (!userId) return;
        setSavingClarity(true);
        setClaritySaveMessage(null);
        setClarityClientConsent(newConsent);
        setClarityStatus('disabled');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const body = {
                clarity: {
                    projectId: clarityProjectId.trim() || null,
                    accountEmail: clarityAccountEmail.trim() || null,
                    accountType: clarityAccountType,
                    status: 'disabled',
                    notes: clarityNotes.trim() || null,
                    clientConsent: newConsent,
                },
            };

            const res = await fetch(apiUrl(`/api/v1/career-identity/admin/requests/${userId}`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    ...(request?.submissionId ? { 'X-CI-Submission-Id': request.submissionId } : {}),
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody?.error?.message || errBody?.message || `Failed to update Clarity consent (${res.status})`);
            }

            setClaritySaveMessage({
                text: newConsent.revokedAt
                    ? 'Consent revoked & tracking disabled successfully.'
                    : 'Consent successfully reset to fresh opt-in.',
                type: 'success',
            });
            await fetchRequest();
            setTimeout(() => setClaritySaveMessage(null), 3500);
        } catch (err: any) {
            setClaritySaveMessage({ text: err?.message || 'Failed to update Clarity consent.', type: 'error' });
        } finally {
            setSavingClarity(false);
        }
    };

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

            const res = await fetch(apiUrl(`/api/v1/career-identity/admin/requests/${userId}`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    ...(request?.submissionId ? { 'X-CI-Submission-Id': request.submissionId } : {}),
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody?.error?.message || errBody?.message || `Failed to save (${res.status})`);
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

    const isPublished = request.status === 'published';
    const publishedProfileId = request.publicId ?? (isPublished ? request.assets.resumeId : null);
    const viewingPublished = view === 'published' && !!request.publishedVersion;
    const displayed = viewingPublished ? request.publishedVersion! : request;
    const hasContent = Object.keys(displayed.content ?? {}).length > 0;
    const viewTitle = viewingPublished || isPublished ? 'Published Profile'
        : request.publishedVersion ? 'Pending Update' : 'Submitted Profile';
    const versionLabel = (version?: number) => version ? ` v${version}` : '';

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
                                <p className="mt-0.5 text-sm text-slate-600">{request.email}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {!isPublished && <>
                                        <span className="text-sm text-slate-700">
                                            {request.publishedVersion ? 'Update' : 'Submission'}{versionLabel(request.versionNumber)}
                                        </span>
                                        {getWorkflowBadge(request.workflowStatus)}
                                    </>}
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${publishedProfileId ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                        {publishedProfileId
                                            ? `Published${versionLabel(request.publishedVersion?.versionNumber ?? (isPublished ? request.versionNumber : undefined))} · Live`
                                            : 'Not published yet'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {request.publishedVersion && (
                <div className="border-b border-slate-200 bg-white">
                    <div role="group" aria-label="Career Identity version" className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 py-3 sm:px-6 lg:px-8">
                        {(['pending', 'published'] as const).map(option => (
                            <button key={option} type="button" aria-controls="ci-version-details" aria-pressed={view === option} disabled={editing || updating}
                                onClick={() => { setView(option); setUpdateError(null); }}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 aria-pressed:bg-[#0B4F6C] aria-pressed:text-white disabled:opacity-60">
                                {option === 'pending' ? 'Pending Update' : 'Published Profile'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Workflow Actions Bar */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-slate-500 mr-2">Actions:</span>

                    {!viewingPublished && request.workflowStatus === 'submitted' && (
                        <button
                            onClick={() => updateWorkflow('in_progress')}
                            disabled={updating}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Accept & Start
                        </button>
                    )}

                    {!viewingPublished && request.workflowStatus === 'in_progress' && (
                        <button
                            onClick={() => updateWorkflow('ready_for_review')}
                            disabled={updating}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                            Mark Ready for Review
                        </button>
                    )}

                    {!viewingPublished && request.workflowStatus === 'ready_for_review' && (
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
                                {request.publishedVersion ? 'Publish Update' : 'Publish'}
                            </button>
                        </>
                    )}

                    {!viewingPublished && request.workflowStatus === 'changes_requested' && (
                        <button
                            onClick={() => updateWorkflow('in_progress')}
                            disabled={updating}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Resume Work
                        </button>
                    )}

                    {!viewingPublished && !editing && (!request.submissionId || !isPublished) && (
                        <button
                            onClick={() => setEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0B4F6C] text-white rounded-lg text-sm font-medium hover:bg-[#0a3d54] transition-colors"
                        >
                            <Edit3 className="w-4 h-4" />
                            {isPublished ? 'Edit Career Identity' : 'Edit Draft'}
                        </button>
                    )}

                    {publishedProfileId && (
                        <a
                            href={`/career-identity/${encodeURIComponent(publishedProfileId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-[#0B4F6C] hover:bg-slate-50"
                        >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            View Published Career Identity
                            <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                    )}

                    {displayed.assets?.resumeId && !editing && (
                        <div className="ml-auto flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleCopyCastId(displayed.assets.resumeId!)}
                                title={viewingPublished || isPublished ? 'Copy Published Cast ID' : 'Copy Submitted Cast ID'}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                {copiedCastId ? (
                                    <>
                                        <Check className="w-4 h-4 text-emerald-600" />
                                        <span className="text-emerald-600 font-medium">Copied ID</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 text-slate-500" />
                                        <span>{viewingPublished || isPublished ? 'Copy Published Cast ID' : 'Copy Submitted Cast ID'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {updateError && (
                        <span className="text-sm text-red-600 flex items-center gap-1 ml-2">
                            <AlertCircle className="w-4 h-4" /> {updateError}
                        </span>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <main id="ci-version-details" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {!viewingPublished && !editing && request.comparison && (
                    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="text-sm font-semibold text-slate-900">What changed from the published profile</h2>
                        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
                            <li>Resume: {request.comparison.resumeChanged ? 'Changed' : 'Unchanged'}</li>
                            <li>Intro video: {request.comparison.videoChanged ? 'Changed' : 'Unchanged'}</li>
                            <li>Profile content: {request.comparison.contentSections.length
                                ? request.comparison.contentSections.map(section => section === 'hero' ? 'Identity' : section[0].toUpperCase() + section.slice(1)).join(', ')
                                : 'Matches published profile'}</li>
                        </ul>
                    </section>
                )}
                {editing ? (
                    <CareerIdentityAdminEditor
                        userId={userId || request.userId}
                        submissionId={request.submissionId}
                        initialContent={request.content as CareerIdentityContent}
                        initialThemeId={request.themeId}
                        initialStatus={request.status as CareerIdentityProfileStatus}
                        resumeId={request.assets.resumeId}
                        resumeUrl={request.assets.resumeUrl}
                        videoUrl={request.assets.introVideoUrl}
                        appearanceLocked={!!request.publicId}
                        canPublish={!request.submissionId || request.workflowStatus === 'ready_for_review'}
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
                                    {viewTitle}{versionLabel(displayed.versionNumber)}
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
                                        <p className="text-xs text-slate-500 font-medium">{viewingPublished || isPublished ? 'Published Cast ID' : 'Submitted Cast ID'}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <p className="text-sm text-slate-600 font-mono text-xs">{displayed.assets?.resumeId || '—'}</p>
                                            {displayed.assets?.resumeId && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyCastId(displayed.assets.resumeId!)}
                                                    title={viewingPublished || isPublished ? 'Copy Published Cast ID' : 'Copy Submitted Cast ID'}
                                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    {copiedCastId ? (
                                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Subscription Tier</p>
                                        <p className="text-sm font-semibold text-slate-900 capitalize">{request.tier}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">{displayed.publishedAt ? 'Published on' : 'Submitted on'}</p>
                                        <p className="text-sm text-slate-900">{formatDate(displayed.publishedAt ?? displayed.submissionDate)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Last Updated</p>
                                        <p className="text-sm text-slate-900">{formatDate(displayed.updatedAt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Theme</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{
                                                backgroundColor: displayed.themeId === 'zenith' ? '#0f766e' : displayed.themeId === 'atlas' ? '#881337' : '#2563eb'
                                            }} />
                                            <p className="text-sm font-semibold text-slate-900 capitalize">
                                                {displayed.themeId || 'Not assigned'}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Job Title</p>
                                        <p className="text-sm text-slate-900">{displayed.assets.jobTitle || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Resume Preview Card */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-500" />
                                    Resume
                                </h2>
                                {displayed.assets.resumeUrl ? (
                                    <div className="space-y-3">
                                        <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden" style={{ height: '500px' }}>
                                            <iframe
                                                src={displayed.assets.resumeUrl}
                                                className="w-full h-full"
                                                title="Resume Preview"
                                            />
                                        </div>
                                        <a
                                            href={displayed.assets.resumeUrl}
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
                                {displayed.assets.introVideoUrl ? (
                                    <div className="space-y-3">
                                        <div className="bg-black rounded-lg overflow-hidden">
                                            <video
                                                controls
                                                className="w-full h-auto"
                                                style={{ maxHeight: '400px' }}
                                                src={displayed.assets.introVideoUrl}
                                            >
                                                <source src={displayed.assets.introVideoUrl} type="video/webm" />
                                                <source src={displayed.assets.introVideoUrl} type="video/mp4" />
                                            </video>
                                        </div>
                                        {displayed.assets.recordingCreatedAt && (
                                            <p className="text-xs text-slate-500">
                                                Recorded: {formatDate(displayed.assets.recordingCreatedAt)}
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
                                        {getWorkflowBadge(viewingPublished ? 'published' : request.workflowStatus)}
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium mb-1">Publish Status</p>
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${(isPublished || viewingPublished)
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            <Shield className="w-3.5 h-3.5" />
                                            {viewingPublished ? 'published' : request.status}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium mb-1">Theme</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{
                                                backgroundColor: displayed.themeId === 'zenith' ? '#0f766e' : displayed.themeId === 'atlas' ? '#881337' : '#2563eb'
                                            }} />
                                            <p className="text-sm font-semibold text-slate-900 capitalize">
                                                {displayed.themeId || 'Not assigned'}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium mb-1">Profile Content</p>
                                        <p className="text-sm text-slate-900">
                                            {hasContent ? 'Content exists' : 'No content yet'}
                                        </p>
                                    </div>
                                    {displayed.assets.jobDescription && (
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium mb-1">AI Script</p>
                                            <p className="text-sm text-slate-600 line-clamp-4">
                                                {displayed.assets.jobDescription}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Content preview */}
                            {hasContent && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-slate-500" />
                                        {viewingPublished || isPublished ? 'Published Content' : 'Draft Content'}
                                    </h2>
                                    <div className="space-y-3 text-sm">
                                        {(displayed.content.about as string) && (
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">About</p>
                                                <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-700">{displayed.content.about as string}</p>
                                            </div>
                                        )}
                                        {Array.isArray(displayed.content.experience) && (displayed.content.experience as any[]).length > 0 && (
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">Experience</p>
                                                <p className="text-slate-700 mt-0.5">{(displayed.content.experience as any[]).length} entries</p>
                                            </div>
                                        )}
                                        {Array.isArray(displayed.content.education) && (displayed.content.education as any[]).length > 0 && (
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">Education</p>
                                                <ul className="mt-1 space-y-1 text-slate-700">
                                                    {(displayed.content as CareerIdentityContent).education?.map(entry => (
                                                        <li key={entry.id}>{[entry.degree, entry.institution].filter(Boolean).join(' · ')}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {Array.isArray(displayed.content.skills) && (displayed.content.skills as any[]).length > 0 && (
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">Skills</p>
                                                <p className="mt-1 break-words text-slate-700">
                                                    {(displayed.content as CareerIdentityContent).skills?.map(skill => skill.name).join(', ')}
                                                </p>
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
                                    {request.submissionId ? (
                                        (isPublished || viewingPublished) && request.publicId ? (
                                            <a href={apiUrl(`/api/v1/wallet/${request.publicId}/card`)}
                                                className="inline-flex items-center gap-2 rounded-lg bg-[#0B4F6C] px-4 py-2 text-sm font-medium text-white">
                                                <Download className="w-4 h-4" /> Download published wallet card
                                            </a>
                                        ) : <p className="text-sm text-slate-600">{request.publishedVersion ? 'Find the live wallet card in Published Profile.' : 'The wallet card is available after publication.'}</p>
                                    ) : <>
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

                                    </>}

                                    {/* Wallet Pass URL Editable Field */}
                                    {!viewingPublished && <div>
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
                                                        const response = await fetch(apiUrl(`/api/v1/career-identity/admin/requests/${userId}`), {
                                                            method: 'PATCH',
                                                            headers: {
                                                                Authorization: `Bearer ${session.access_token}`,
                                                                'Content-Type': 'application/json',
                                                                ...(request.submissionId ? { 'X-CI-Submission-Id': request.submissionId } : {}),
                                                            },
                                                            body: JSON.stringify({ walletPassUrl }),
                                                        });
                                                        if (!response.ok) {
                                                            const body = await response.json().catch(() => ({}));
                                                            throw new Error(body.error?.message || 'Failed to save the wallet URL.');
                                                        }
                                                        await fetchRequest();
                                                    } catch (err: any) {
                                                        setWalletCardError(err.message || 'Failed to save the wallet URL.');
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
                                    </div>}

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
                {!editing && <section className="mt-8" aria-label="Project settings">
                            {/* Microsoft Clarity Integration Card */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                    <div>
                                        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                            <span className="text-base">📊</span>
                                            Microsoft Clarity (Recruiter Session Replays)
                                        </h2>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Configure dedicated tracking project for this candidate
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {clarityStatus === 'disabled' ? (
                                            clarityClientConsent.revokedAt || (!clarityClientConsent.accepted && clarityClientConsent.acceptedAt) ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
                                                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                                                    Disabled (Consent Revoked {clarityClientConsent.revokedAt ? `on ${new Date(clarityClientConsent.revokedAt).toLocaleDateString()}` : ''})
                                                </span>
                                            ) : clarityClientConsent.accepted ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300">
                                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                    Disabled by Admin (Client Consented)
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                                                    Pending Client Opt-In
                                                </span>
                                            )
                                        ) : clarityStatus === 'pending' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300">
                                                <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                                                Client Accepted {clarityClientConsent.acceptedAt ? `on ${new Date(clarityClientConsent.acceptedAt).toLocaleDateString()}` : ''} (Setup Needed)
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                                Live · Client Accepted {clarityClientConsent.acceptedAt ? `on ${new Date(clarityClientConsent.acceptedAt).toLocaleDateString()}` : ''}
                                            </span>
                                        )}

                                        {/* Quick Action to revoke or reset consent */}
                                        {clarityClientConsent.accepted ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleDirectConsentChange({
                                                        accepted: false,
                                                        acceptedAt: clarityClientConsent.acceptedAt,
                                                        revokedAt: new Date().toISOString(),
                                                    });
                                                }}
                                                disabled={savingClarity}
                                                className="text-[11px] text-red-600 hover:text-red-700 underline font-medium cursor-pointer disabled:opacity-50"
                                                title="Mark that the client requested to revoke consent and disable tracking"
                                            >
                                                Revoke Client Consent
                                            </button>
                                        ) : (!clarityClientConsent.accepted && (clarityClientConsent.revokedAt || clarityClientConsent.acceptedAt)) ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleDirectConsentChange({
                                                        accepted: false,
                                                        acceptedAt: null,
                                                        revokedAt: null,
                                                    });
                                                }}
                                                disabled={savingClarity}
                                                className="text-[11px] text-slate-500 hover:text-slate-700 underline cursor-pointer disabled:opacity-50"
                                                title="Reset to fresh never-opted-in state"
                                            >
                                                Reset to Fresh Opt-In
                                            </button>
                                        ) : null}
                                    </div>
                                </div>

                                {!isEditingClarity ? (
                                    /* ── View Mode (Clean Summary) ── */
                                    <div className="space-y-4 pt-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 border border-slate-200/80 rounded-xl p-4">
                                            <div>
                                                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Account Model</p>
                                                <p className="text-xs font-semibold text-slate-800 mt-1">
                                                    {clarityAccountType === 'company_zoho'
                                                        ? '🏢 Company Zoho Mail'
                                                        : clarityAccountType === 'client_personal'
                                                        ? '👤 Client Personal Email'
                                                        : '— Not Configured'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Clarity Account Email</p>
                                                <p className="text-xs font-mono font-semibold text-slate-800 mt-1">
                                                    {clarityAccountEmail || '— Not set'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Clarity Project ID</p>
                                                <p className="text-xs font-mono font-semibold text-slate-800 mt-1">
                                                    {clarityProjectId || '— Not provisioned'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Tracking Status</p>
                                                <div className="mt-1">
                                                    {clarityStatus === 'active' && clarityProjectId ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                                                            Active (Recording on public page)
                                                        </span>
                                                    ) : clarityStatus === 'pending' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                                                            <Clock className="w-3 h-3 text-amber-600" />
                                                            Pending Setup
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                                                            Disabled (No tracking)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Suggested Project Name in Microsoft Clarity */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[11px] font-semibold text-slate-700">Suggested Project Name in Microsoft Clarity:</p>
                                                    <p className="text-xs font-mono text-[#0B4F6C] font-semibold mt-0.5">
                                                        Career Identifier - {clarityAccountEmail || request?.email || 'candidate@applywizz.com'}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const projName = `Career Identifier - ${clarityAccountEmail || request?.email || ''}`;
                                                        navigator.clipboard.writeText(projName);
                                                        setCopiedProjectEmail(true);
                                                        setTimeout(() => setCopiedProjectEmail(false), 2000);
                                                    }}
                                                    className="text-xs text-[#0B4F6C] bg-white border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                                                >
                                                    {copiedProjectEmail ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</> : <><Copy className="w-3.5 h-3.5 text-slate-600" /> Copy Project Name</>}
                                                </button>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                When creating the project in Microsoft Clarity, use this as the <strong>Project Name</strong>, and invite <strong>{clarityAccountEmail || request?.email || 'the email above'}</strong> as a <strong>Member</strong>.
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-wrap items-center gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingClarity(true)}
                                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B4F6C] hover:bg-[#0a3d54] text-white rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                                Edit Clarity Config
                                            </button>

                                            <a
                                                href={clarityProjectId ? `https://clarity.microsoft.com/projects/view/${clarityProjectId}/dashboard` : 'https://clarity.microsoft.com'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border border-slate-200"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                {clarityProjectId ? 'Open Clarity Console ↗' : 'Open Microsoft Clarity ↗'}
                                            </a>

                                            {claritySaveMessage && (
                                                <span className={`text-xs font-medium flex items-center gap-1 ${claritySaveMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {claritySaveMessage.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                                    {claritySaveMessage.text}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* ── Edit Mode ── */
                                    <div className="space-y-4 pt-2">
                                        {/* Account Model */}
                                        <div>
                                            <label className="text-xs text-slate-500 font-medium block mb-2">Account Model</label>
                                            <div className="flex items-center gap-6">
                                                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="accountType"
                                                        value="company_zoho"
                                                        checked={clarityAccountType === 'company_zoho'}
                                                        onChange={() => {
                                                            setClarityAccountType('company_zoho');
                                                            if (clarityAccountEmail === request?.email) {
                                                                setClarityAccountEmail('');
                                                            }
                                                        }}
                                                        className="text-[#0B4F6C] focus:ring-[#0B4F6C]"
                                                    />
                                                    Company Zoho Mail
                                                </label>
                                                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="accountType"
                                                        value="client_personal"
                                                        checked={clarityAccountType === 'client_personal'}
                                                        onChange={() => {
                                                            setClarityAccountType('client_personal');
                                                            if (request?.email) {
                                                                setClarityAccountEmail(request.email);
                                                            }
                                                        }}
                                                        className="text-[#0B4F6C] focus:ring-[#0B4F6C]"
                                                    />
                                                    Client Personal Email
                                                </label>
                                            </div>
                                        </div>

                                        {/* Clarity Account Email */}
                                        <div>
                                            <label className="text-xs text-slate-500 font-medium block mb-1">
                                                Clarity Account Email <span className="text-slate-400 font-normal">(Invite this email as a Member)</span>
                                            </label>
                                            <input
                                                type="email"
                                                value={clarityAccountEmail}
                                                onChange={(e) => setClarityAccountEmail(e.target.value)}
                                                placeholder={clarityAccountType === 'company_zoho' ? 'e.g. candidate@applywizz.com' : (request?.email || 'Enter account email')}
                                                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0B4F6C]"
                                            />
                                        </div>

                                        {/* Suggested Project Name in Microsoft Clarity */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[11px] font-semibold text-slate-700">Suggested Project Name in Microsoft Clarity:</p>
                                                    <p className="text-xs font-mono text-[#0B4F6C] font-semibold mt-0.5">
                                                        Career Identifier - {clarityAccountEmail || request?.email || 'candidate@applywizz.com'}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const projName = `Career Identifier - ${clarityAccountEmail || request?.email || ''}`;
                                                        navigator.clipboard.writeText(projName);
                                                        setCopiedProjectEmail(true);
                                                        setTimeout(() => setCopiedProjectEmail(false), 2000);
                                                    }}
                                                    className="text-xs text-[#0B4F6C] bg-white border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                                                >
                                                    {copiedProjectEmail ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</> : <><Copy className="w-3.5 h-3.5 text-slate-600" /> Copy Project Name</>}
                                                </button>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                When creating the project in Microsoft Clarity, use this as the <strong>Project Name</strong>, and invite <strong>{clarityAccountEmail || request?.email || 'the email above'}</strong> as a <strong>Member</strong>.
                                            </p>
                                        </div>

                                        {/* Project ID & Tracking Status */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-500 font-medium block mb-1">Clarity Project ID</label>
                                                <input
                                                    type="text"
                                                    value={clarityProjectId}
                                                    onChange={(e) => setClarityProjectId(e.target.value)}
                                                    placeholder="e.g. p9x7b2k1lm"
                                                    className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0B4F6C]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 font-medium block mb-1">Tracking Status</label>
                                                <select
                                                    value={clarityStatus}
                                                    onChange={(e) => setClarityStatus(e.target.value as any)}
                                                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0B4F6C]"
                                                >
                                                    <option value="disabled">Disabled (No tracking)</option>
                                                    <option value="pending">Pending (Awaiting setup)</option>
                                                    <option value="active">Active (Recording on public page)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Status helper text */}
                                        <div className="text-xs text-slate-500 pt-1">
                                            {clarityStatus === 'active' && clarityProjectId ? (
                                                <p className="text-emerald-700 flex items-center gap-1 font-medium">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    Active: Public page (/career-identity/{publishedProfileId || displayed.assets?.resumeId || '...'}) is streaming recordings to this project ID.
                                                </p>
                                            ) : clarityStatus === 'pending' ? (
                                                <p className="text-amber-700 flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    Pending: Client accepted or requested Clarity. Provision project and switch status to Active.
                                                </p>
                                            ) : (
                                                <p className="text-slate-500">
                                                    Disabled: Clarity scripts will NOT load on the candidate's public page.
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-wrap items-center gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={handleSaveClarity}
                                                disabled={savingClarity}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B4F6C] hover:bg-[#0a3d54] text-white rounded-lg text-xs font-medium transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                                            >
                                                {savingClarity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                                💾 Save Changes
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleCancelClarityEdit}
                                                disabled={savingClarity}
                                                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-medium transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>

                                            {claritySaveMessage && (
                                                <span className={`text-xs font-medium flex items-center gap-1 ${claritySaveMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {claritySaveMessage.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                                    {claritySaveMessage.text}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                </section>}
            </main>

        </div>
    );
}
