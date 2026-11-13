import { PublishedAppearanceEditor } from '../components/PublishedAppearanceEditor';
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { useAuthContext } from '../../../contexts/AuthContext';
import { fetchCareerIdentityDashboard, submitCareerIdentity, updateCareerIdentityConsent, withdrawCareerIdentitySubmission, type CareerIdentityDashboardData, type SubmissionRecording } from '../services/careerIdentityService';
import { Loader2, Eye, Sparkles, Send, AlertCircle, RefreshCw, Clock, CheckCircle, FileText, UserCircle, Home, LogOut, ChevronDown, KeyRound, CreditCard, HelpCircle, Globe, BookOpen, Briefcase } from 'lucide-react';
import ResumeWorkspace from '../../resume-dashboard/components/ResumeWorkspace';
import type { CareerIdentityWorkflowStatus } from '../../../types/careerIdentity';
import { apiUrl } from '../../../lib/apiBase';

type TierState = 'loading' | 'digital_resume' | 'career_identity' | 'null_tier' | 'error';
const headerActionClass = 'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors';
const accountLinkGroups = [
    [
        { to: '/profile', label: 'Account Profile', icon: UserCircle },
        { to: '/password', label: 'Password', icon: KeyRound },
        { to: '/billing', label: 'Billing & Payment', icon: CreditCard },
    ],
    [
        { to: '/network', label: 'Network', icon: Globe },
        { to: '/resources', label: 'Resources', icon: BookOpen },
        { to: '/hr-email', label: 'HR Emails', icon: Briefcase },
    ],
    [
        { to: '/contact', label: 'Support', icon: HelpCircle },
    ],
];

const recordingDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const recordingLabel = (recording: SubmissionRecording) =>
    `Recording-${recording.number} · ${recordingDate(recording.createdAt)}`;

export default function CareerIdentityDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuthContext();
    const [tier, setTier] = useState<TierState>('loading');
    const [editingAppearance, setEditingAppearance] = useState(false);
    const [appearanceSaved, setAppearanceSaved] = useState(false);
    const [dashboard, setDashboard] = useState<CareerIdentityDashboardData | null>(null);
    const [profileError, setProfileError] = useState(false);
    const [selectionIndex, setSelectionIndex] = useState<number | null>(null);
    const [confirmationKey, setConfirmationKey] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [loadingPicker, setLoadingPicker] = useState(false);
    const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
    const [withdrawing, setWithdrawing] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [consentChecked, setConsentChecked] = useState(false);
    const [enablingClarity, setEnablingClarity] = useState(false);
    const [disablingClarity, setDisablingClarity] = useState(false);
    const [clarityError, setClarityError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setDashboard(await fetchCareerIdentityDashboard());
        setProfileError(false);
    }, []);
    useEffect(() => {
        if (tier !== 'career_identity' || !user?.id) return;
        let active = true;
        fetchCareerIdentityDashboard().then(data => {
            if (active) setDashboard(data);
        }).catch(() => {
            if (active) setProfileError(true);
        });
        return () => { active = false; };
    }, [tier, user?.id]);

    useEffect(() => {
        let cancelled = false;
        const resolveTier = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) { if (!cancelled) setTier('error'); return; }
                const res = await fetch(apiUrl('/api/v1/subscription/me'), { headers: { Authorization: `Bearer ${session.access_token}` } });
                if (!res.ok) { if (!cancelled) setTier('null_tier'); return; }
                const body = await res.json();
                const rawTier = body?.data?.tier;
                if (!cancelled) {
                    if (rawTier === 'career_identity') setTier('career_identity');
                    else if (rawTier === 'digital_resume') setTier('digital_resume');
                    else setTier('null_tier');
                }
            } catch { if (!cancelled) setTier('null_tier'); }
        };
        resolveTier();
        return () => { cancelled = true; };
    }, []);

    const handleSubmit = async () => {
        const selected = selectionIndex === null ? null : dashboard?.eligible[selectionIndex];
        if (!selected || submitting) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            await submitCareerIdentity(selected, confirmationKey, dashboard?.pending?.id ?? null);
            await refresh();
            setSelectionIndex(null);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Failed to submit. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleWithdraw = async () => {
        if (!withdrawalId || withdrawing) return;
        setWithdrawing(true);
        setSubmitError(null);
        try {
            await withdrawCareerIdentitySubmission(withdrawalId);
            setDashboard(previous => previous?.pending?.id === withdrawalId ? {
                ...previous,
                pending: null,
                workflowStatus: previous.publishedId ? 'published' : 'not_submitted',
            } : previous);
            setWithdrawalId(null);
            await refresh().catch(() => undefined);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Unable to withdraw the submission.');
        } finally {
            setWithdrawing(false);
        }
    };

    const openPicker = async () => {
        setLoadingPicker(true);
        setSubmitError(null);
        try {
            const data = await fetchCareerIdentityDashboard();
            setDashboard(data);
            if (!data.eligible.length) {
                setSubmitError('Finish recording a Digital Resume before submitting.');
                return;
            }
            setConfirmationKey(crypto.randomUUID());
            setSelectionIndex(0);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Unable to load your recordings.');
        } finally {
            setLoadingPicker(false);
        }
    };

    const changeConsent = async (accepted: boolean) => {
        const setSaving = accepted ? setEnablingClarity : setDisablingClarity;
        setSaving(true);
        setClarityError(null);
        try {
            await updateCareerIdentityConsent(accepted);
            await refresh();
            if (!accepted) setConsentChecked(false);
        } catch (error) {
            setClarityError(error instanceof Error ? error.message : 'Unable to update recording consent.');
        } finally {
            setSaving(false);
        }
    };
    const handleEnableClarity = () => changeConsent(true);
    const handleDisableClarity = () => changeConsent(false);

    if (tier === 'loading' || tier === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0B4F6C] mx-auto mb-4" />
                    <p className="text-slate-500 text-sm">{tier === 'loading' ? 'Loading your dashboard…' : 'Unable to verify access. Redirecting…'}</p>
                </div>
            </div>
        );
    }

    if (tier === 'digital_resume') return <Navigate to="/dashboard" replace />;
    if (tier === 'null_tier') return <Navigate to="/" replace />;

    const isLoading = !dashboard && !profileError;
    const workflowStatus = (dashboard?.workflowStatus ?? 'not_submitted') as CareerIdentityWorkflowStatus;
    const latest = dashboard?.eligible[0];
    const pending = dashboard?.pending;
    const publishedId = dashboard?.publishedId;
    const summary = dashboard?.summary;
    const accountEmail = summary?.email || user?.email;
    const selection = selectionIndex === null ? null : dashboard?.eligible[selectionIndex];
    const isFrozen = !pending && ['submitted', 'in_progress'].includes(workflowStatus);

    const renderWorkflowSection = () => (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">
                {pending ? (publishedId ? 'Update submitted' : 'Submission received')
                    : publishedId ? 'Career Identity is published'
                    : isFrozen ? 'Career Identity is in progress' : 'Submit for Career Identity'}
            </h2>
            {pending && (
                <div className="space-y-2 text-sm">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-medium text-slate-600">{publishedId ? 'Recording submitted for this update' : 'Submitted recording'}</p>
                        <p className="mt-1 font-semibold text-slate-900">{pending.recording ? recordingLabel(pending.recording) : 'Digital Resume on this submission'}</p>
                        <p className="mt-1 text-xs text-slate-600">
                            Submitted {recordingDate(pending.submittedAt)} · {workflowStatus === 'submitted' ? 'Awaiting review' : workflowStatus.replaceAll('_', ' ')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <a className="text-teal-700 underline" href={pending.resumeUrl} target="_blank" rel="noreferrer">Submitted PDF</a>
                        <a className="text-teal-700 underline" href={pending.videoUrl} target="_blank" rel="noreferrer">Submitted intro video</a>
                    </div>
                </div>
            )}
            {publishedId && (dashboard?.publishedRecording || pending) && (
                <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-900">Live profile:</span>{' '}
                    {dashboard?.publishedRecording ? recordingLabel(dashboard.publishedRecording) : 'Published Career Identity'}
                    {pending && ' stays live until the update is published.'}
                </p>
            )}
            {!selection && !latest && !pending && <p className="text-sm text-slate-600">Upload a resume and finish recording an intro video on the same Digital Resume entry.</p>}
            {!selection && !withdrawalId && !isFrozen && (
                <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={openPicker} disabled={loadingPicker} className="rounded-lg bg-[#0B4F6C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                        {loadingPicker ? 'Loading recordings…' : pending ? 'Replace pending submission' : publishedId ? 'Submit an update' : 'Choose Digital Resume'}
                    </button>
                    {pending && (
                        <button type="button" disabled={loadingPicker} onClick={() => { setWithdrawalId(pending.id); setSubmitError(null); }}
                            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                            Withdraw pending submission
                        </button>
                    )}
                </div>
            )}
            {withdrawalId && (
                <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Withdraw this submission?</h3>
                    <p className="text-sm text-slate-700">
                        {publishedId
                            ? 'The team will stop reviewing this update. Your published Career Identity stays live.'
                            : 'The team will stop reviewing this request. You can submit a Digital Resume again when ready.'}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button type="button" disabled={withdrawing} onClick={handleWithdraw}
                            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                            {withdrawing ? 'Withdrawing…' : 'Confirm withdrawal'}
                        </button>
                        <button type="button" disabled={withdrawing} onClick={() => { setWithdrawalId(null); setSubmitError(null); }}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">
                            Keep submission
                        </button>
                    </div>
                </div>
            )}
            {selection && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                    <label htmlFor="ci-resume-selection" className="block text-sm font-medium">Digital Resume to submit</label>
                    <div className="relative">
                        <select id="ci-resume-selection" value={selectionIndex ?? 0} disabled={submitting}
                            onChange={event => { setSelectionIndex(Number(event.target.value)); setConfirmationKey(crypto.randomUUID()); setSubmitError(null); }}
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-900 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/30 disabled:opacity-60">
                            {dashboard?.eligible.map((resume, index) => (
                                <option key={`${resume.source}:${resume.castId}`} value={index}>
                                    Recording-{resume.recordingNumber} · {recordingDate(resume.createdAt)}
                                </option>
                            ))}
                        </select>
                        <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                        <a className="text-teal-700 underline" href={selection.resumeUrl} target="_blank" rel="noreferrer">Preview PDF</a>
                        <a className="text-teal-700 underline" href={selection.videoUrl} target="_blank" rel="noreferrer">Preview intro video</a>
                    </div>
                    {pending && <p className="text-sm text-amber-800">This replaces the submission the team is currently reviewing.</p>}
                    <div className="flex flex-wrap gap-3">
                        <button type="button" disabled={submitting} onClick={handleSubmit} className="rounded-lg bg-[#0B4F6C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                            {submitting ? 'Submitting…' : 'Confirm submission'}
                        </button>
                        <button type="button" disabled={submitting} onClick={() => { setSelectionIndex(null); setSubmitError(null); }} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                    </div>
                </div>
            )}
            {submitError && <p role="alert" className="text-sm text-red-600">{submitError}</p>}
        </section>
    );

    const clarity = dashboard?.clarity;
    const clarityStatus = clarity?.status || 'disabled';
    const clarityProjectId = clarity?.projectId;
    const isConsentAccepted = !!clarity?.clientConsent?.accepted;
    const isRevoked = !isConsentAccepted && !!clarity?.clientConsent?.revokedAt;

    const renderClarityCard = () => {
        if (clarityStatus === 'active' && clarityProjectId) {
            return (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🎥</span>
                                <h3 className="text-lg font-bold text-slate-900">Recruiter Session Recordings & Heatmaps</h3>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                See exactly how recruiters interact with your portfolio and resume.
                            </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                        </span>
                    </div>

                    <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                        Watch real session replays, see where recruiters scrolled, what they clicked, and what caught their attention on your Career Identity page.
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-3">
                            <a
                                href={`https://clarity.microsoft.com/projects/view/${clarityProjectId}/dashboard`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0B4F6C] hover:bg-[#0B4F6C]/90 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]"
                            >
                                <span>▶</span> Watch Recruiter Replays & Heatmaps ↗
                            </a>
                            <button
                                type="button"
                                onClick={handleDisableClarity}
                                disabled={disablingClarity}
                                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 text-xs font-semibold transition-all"
                            >
                                {disablingClarity ? 'Pausing...' : 'Pause / Disable Recordings'}
                            </button>
                        </div>
                        <span className="text-xs text-slate-400">
                            Account: <strong className="text-slate-600">{clarity?.accountEmail || user?.email}</strong>
                        </span>
                    </div>
                </div>
            );
        }

        if (clarityStatus === 'pending') {
            return (
                <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🎥</span>
                            <h3 className="text-lg font-bold text-slate-900">Recruiter Session Recordings</h3>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 self-start sm:self-auto">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            Setting Up
                        </span>
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed">
                        Your request has been received! Your career coach is provisioning your dedicated Microsoft Clarity suite under{' '}
                        <strong className="text-slate-900">{clarity?.accountEmail || user?.email}</strong>.
                    </p>

                    <div className="mt-4 p-4 rounded-lg bg-amber-100/60 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                        You will receive an invitation email from Microsoft shortly. Once you click <strong>"Accept invitation"</strong> and sign in, your replays will be ready to view.
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-amber-200/60">
                        <span className="text-xs text-amber-900">
                            Changed your mind? You can cancel your request anytime.
                        </span>
                        <button
                            type="button"
                            onClick={handleDisableClarity}
                            disabled={disablingClarity}
                            className="text-xs font-semibold text-amber-800 hover:text-red-700 underline self-start sm:self-auto"
                        >
                            {disablingClarity ? 'Canceling...' : 'Cancel Request & Disable'}
                        </button>
                    </div>
                </div>
            );
        }

        // Default: Disabled State (Requires client opt-in)
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🎥</span>
                        <h3 className="text-lg font-bold text-slate-900">Recruiter Session Recordings & Heatmaps</h3>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 self-start sm:self-auto">
                        {isRevoked ? 'Paused / Disabled' : 'Disabled'}
                    </span>
                </div>

                <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    {isRevoked
                        ? 'Check the box and confirm to resume recruiter recordings. If setup is needed, our team will finish it.'
                        : 'Want to see how recruiters interact with your resume? With Microsoft Clarity, you can watch live screen recordings, see where recruiters scroll, what they read, and which links they click.'}
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={consentChecked}
                            onChange={(e) => setConsentChecked(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0B4F6C] focus:ring-[#0B4F6C]"
                        />
                        <span className="text-sm text-slate-700 select-none">
                            I consent to enabling recruiter session recordings on my public Career Identity page.
                        </span>
                    </label>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <button
                        onClick={handleEnableClarity}
                        disabled={!consentChecked || enablingClarity}
                        className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                            consentChecked && !enablingClarity
                                ? 'bg-[#0B4F6C] hover:bg-[#0B4F6C]/90 text-white shadow-md active:scale-[0.98]'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        }`}
                    >
                        {enablingClarity ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Enabling...
                            </>
                        ) : isRevoked ? (
                            '✓ Re-Enable Recruiter Recordings'
                        ) : (
                            '✓ Accept & Enable Recruiter Recordings'
                        )}
                    </button>
                    <p className="text-xs text-slate-400">
                        100% free forever · Backed by Microsoft · You can pause anytime
                    </p>
                </div>

                {clarityError && (
                    <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {clarityError}
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div><h1 className="text-xl font-bold text-slate-900">Career Identity</h1><p className="text-sm text-slate-500">Premium Profile Dashboard</p></div>
                    <div className="flex flex-wrap items-center gap-2">
                        <details
                            className="relative"
                            onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                    event.currentTarget.open = false;
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape' && event.currentTarget.open) {
                                    event.currentTarget.open = false;
                                    event.currentTarget.querySelector('summary')?.focus();
                                }
                            }}
                        >
                            <summary className={`${headerActionClass} cursor-pointer list-none border-slate-200 text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden`}>
                                <UserCircle size={16} aria-hidden="true" />
                                Account
                                <ChevronDown size={14} aria-hidden="true" />
                            </summary>
                            <nav aria-label="Account" className="absolute left-0 z-30 mt-2 w-48 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-1.5 shadow-lg">
                                {accountLinkGroups.map((links) => (
                                    <div key={links[0].to} className="py-1.5">
                                        {links.map(({ to, label, icon: Icon }) => (
                                            <Link key={to} to={to} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                                <Icon size={16} aria-hidden="true" />
                                                {label}
                                            </Link>
                                        ))}
                                    </div>
                                ))}
                            </nav>
                        </details>
                        <Link to="/" className={`${headerActionClass} border-slate-200 text-slate-700 hover:bg-slate-50`}>
                            <Home size={16} aria-hidden="true" />
                            Back to Home
                        </Link>
                        <button
                            type="button"
                            onClick={async () => {
                                await logout();
                                navigate('/auth', { replace: true });
                            }}
                            className={`${headerActionClass} border-rose-200 text-rose-700 hover:bg-rose-50`}
                        >
                            <LogOut size={16} aria-hidden="true" />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-[#0B4F6C]" /></div>
            ) : profileError ? (
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <p className="text-slate-500 mb-4">Unable to load your Career Identity profile.</p>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">Try Again</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="bg-gray-50 px-4 pt-4 sm:px-8 sm:pt-6">
                        <section aria-labelledby="ci-profile-summary"
                            className="mx-auto flex max-w-7xl flex-col gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                                    <UserCircle className="h-5 w-5 text-[#0B4F6C]" aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <h2 id="ci-profile-summary" className="break-words text-lg font-semibold text-slate-900">
                                        {summary?.name || 'Your profile'}
                                    </h2>
                                    {accountEmail && <p className="break-words text-sm text-slate-500">{accountEmail}</p>}
                                    {latest && (
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-emerald-700">
                                            <span className="inline-flex items-center gap-1"><CheckCircle size={13} aria-hidden="true" /> Resume uploaded</span>
                                            <span className="inline-flex items-center gap-1"><CheckCircle size={13} aria-hidden="true" /> Video recorded</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="sm:shrink-0 sm:text-right">
                                <div className="flex flex-wrap gap-2 sm:justify-end">
                                    <button type="button" disabled={!latest} onClick={() => latest && navigate(`/final-result/${latest.castId}`)}
                                        className="inline-flex items-center gap-2 rounded-lg bg-[#0B4F6C] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                                        <FileText size={16} aria-hidden="true" /> View Digital Resume
                                    </button>
                                    <button type="button" disabled={!publishedId} onClick={() => publishedId && navigate(`/career-identity/${publishedId}`)}
                                        className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                                        <Eye size={16} aria-hidden="true" /> View Career Identity
                                    </button>
                                    {dashboard?.appearance && !editingAppearance && (
                                        <button type="button" onClick={() => { setAppearanceSaved(false); setEditingAppearance(true); }}
                                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                            Edit Appearance
                                        </button>
                                    )}
                                </div>
                                {!publishedId && <p className="mt-2 text-xs text-slate-600">Career Identity is available after publication.</p>}
                            </div>
                        </section>
                        {editingAppearance && dashboard?.appearance && (
                            <div className="mx-auto max-w-7xl">
                                <PublishedAppearanceEditor key={dashboard.appearance.submissionId}
                                    appearance={dashboard.appearance} name={summary?.name || 'Your profile'}
                                    onClose={() => setEditingAppearance(false)}
                                    onSaved={appearance => {
                                        setDashboard(previous => previous ? { ...previous, appearance } : previous);
                                        setEditingAppearance(false);
                                        setAppearanceSaved(true);
                                    }} />
                            </div>
                        )}
                        {appearanceSaved && (
                            <p role="status" className="mx-auto mt-3 flex max-w-7xl items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                                <CheckCircle size={16} className="shrink-0" aria-hidden="true" />
                                Appearance updated on your live profile.
                            </p>
                        )}
                    </div>
                    <ResumeWorkspace user={user} frozen={isFrozen} />
                    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
                        <div className="border-t border-slate-200 pt-8 mb-6">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" /> Career Identity Profile</h2>
                            <p className="text-sm text-slate-500 mt-1">Manage your premium Career Identity profile.</p>
                        </div>
                        <div className="space-y-6">
                            {renderWorkflowSection()}
                            {renderClarityCard()}
                        </div>
                    </main>
                </>
            )}
        </div>
    );
}
