import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { useAuthContext } from '../../../contexts/AuthContext';
import { useCareerIdentityProfile } from '../hooks/useCareerIdentityProfile';
import { updateCareerIdentityProfile } from '../services/careerIdentityService';
import { Loader2, Eye, Sparkles, Send, AlertCircle, RefreshCw, Clock, CheckCircle } from 'lucide-react';
import ResumeWorkspace from '../../resume-dashboard/components/ResumeWorkspace';
import type { CareerIdentityWorkflowStatus } from '../../../types/careerIdentity';

type TierState = 'loading' | 'digital_resume' | 'career_identity' | 'null_tier' | 'error';

export default function CareerIdentityDashboard() {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const [tier, setTier] = useState<TierState>('loading');
    const [resumeId, setResumeId] = useState<string | null>(null);
    const [resumeLoading, setResumeLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [hasResume, setHasResume] = useState(false);
    const [hasVideo, setHasVideo] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const resolveResumeId = async () => {
            if (!user?.id) { if (!cancelled) setResumeLoading(false); return; }
            try {
                const { data: crmData } = await supabase.from('crm_job_requests').select('id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (crmData?.id) { if (!cancelled) { setResumeId(crmData.id); setResumeLoading(false); } return; }
                const { data: regularData } = await supabase.from('job_requests').select('id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (regularData?.id) { if (!cancelled) setResumeId(regularData.id); }
            } catch { /* ignore */ }
            if (!cancelled) setResumeLoading(false);
        };
        resolveResumeId();
        return () => { cancelled = true; };
    }, [user?.id]);

    const checkAssets = useCallback(async () => {
        if (!user?.id) return;
        try {
            const [crmJobs, regJobs] = await Promise.all([
                supabase.from('crm_job_requests').select('id, resume_url').eq('user_id', user.id),
                supabase.from('job_requests').select('id, resume_path').eq('user_id', user.id),
            ]);
            const allJobs = [...(crmJobs.data || []), ...(regJobs.data || [])];
            const hasResumeAsset = allJobs.some((j: any) => j.resume_url || j.resume_path);
            setHasResume(hasResumeAsset);
            if (hasResumeAsset) {
                const jobIds = allJobs.map((j: any) => j.id).filter(Boolean);
                const [crmRecs, regRecs] = await Promise.all([
                    supabase.from('crm_recordings').select('id').in('job_request_id', jobIds).limit(1),
                    supabase.from('recordings').select('id').in('job_request_id', jobIds).limit(1),
                ]);
                setHasVideo(!!((crmRecs.data && crmRecs.data.length > 0) || (regRecs.data && regRecs.data.length > 0)));
            } else { setHasVideo(false); }
        } catch { setHasResume(false); setHasVideo(false); }
    }, [user?.id]);

    useEffect(() => {
        let cancelled = false;
        const resolveTier = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) { if (!cancelled) setTier('error'); return; }
                const res = await fetch('/api/v1/subscription/me', { headers: { Authorization: `Bearer ${session.access_token}` } });
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

    const { profile, derived, loading: profileLoading, error: profileError, refresh } = useCareerIdentityProfile(resumeId);

    useEffect(() => { checkAssets(); }, [checkAssets, profile]);

    const handleSubmit = async () => {
        if (!resumeId || !user?.id) return;
        setSubmitting(true); setSubmitError(null);
        try { await updateCareerIdentityProfile(resumeId, { workflowStatus: 'submitted' }, user.id); await refresh(); }
        catch (err: any) { setSubmitError(err?.message || 'Failed to submit. Please try again.'); }
        finally { setSubmitting(false); }
    };

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

    const isLoading = resumeLoading || profileLoading;
    const workflowStatus: CareerIdentityWorkflowStatus = (profile as any)?.workflowStatus ?? 'not_submitted';

    // Frozen banner only shows while Career Identity is actually under preparation (submitted/in_progress)
    // NOT when it's ready for viewing
    const isFrozen = ['submitted', 'in_progress'].includes(workflowStatus);

    // States where Career Identity is available for viewing
    const isAvailableForViewing = ['ready_for_review', 'changes_requested', 'published'].includes(workflowStatus);

    const renderWorkflowSection = () => {
        // Elegant premium card when Career Identity is ready — no workflow buttons
        if (isAvailableForViewing) {
            return (
                <div className="relative overflow-hidden bg-gradient-to-br from-[#0B4F6C] via-[#0a5a7a] to-[#159A9C] rounded-2xl shadow-xl p-8 sm:p-10 text-center">
                    {/* Decorative background elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-br from-white/[0.03] to-transparent" />

                    <div className="relative z-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-5 ring-4 ring-white/10">
                            <Sparkles className="h-8 w-8 text-white" />
                        </div>
                        {derived?.candidateName && (
                            <h2 className="text-2xl font-bold text-white mb-1">{derived.candidateName}</h2>
                        )}
                        {derived?.jobTitle && (
                            <p className="text-white/70 text-sm font-medium mb-3">{derived.jobTitle}</p>
                        )}
                        <h3 className="text-lg font-bold text-white/90 mb-1">✨ Career Identity</h3>
                        <p className="text-white/60 text-sm mb-7">Your premium Career Identity profile is ready.</p>
                        {resumeId && (
                            <button
                                onClick={() => navigate(`/career-identity/${resumeId}`)}
                                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-[#0B4F6C] rounded-xl font-bold text-sm hover:bg-white/90 hover:shadow-lg active:scale-[0.97] transition-all shadow-md"
                            >
                                <Eye className="w-4 h-4" /> View Career Identity
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        switch (workflowStatus) {
            case 'not_submitted':
                return (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <Sparkles className="h-6 w-6 text-amber-500" />
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Next Step — Career Identity</h2>
                                <p className="text-sm text-slate-500 mt-0.5">Your Career Identity will be professionally created by our team using your uploaded resume and introduction video.</p>
                            </div>
                        </div>
                        <div className="space-y-3 mb-6">
                            <div className={`flex items-center gap-3 p-3 rounded-lg ${hasResume ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                                {hasResume ? <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" /> : <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />}
                                <div><p className="text-sm font-medium text-slate-900">Resume Uploaded</p>{!hasResume && <p className="text-xs text-amber-600">Upload a resume in the section above.</p>}</div>
                            </div>
                            <div className={`flex items-center gap-3 p-3 rounded-lg ${hasVideo ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                                {hasVideo ? <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" /> : <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />}
                                <div><p className="text-sm font-medium text-slate-900">Intro Video Recorded</p>{!hasVideo && <p className="text-xs text-amber-600">Record an intro video in the section above.</p>}</div>
                            </div>
                        </div>
                        <button onClick={handleSubmit} disabled={!hasResume || !hasVideo || submitting}
                            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${hasResume && hasVideo && !submitting ? 'bg-gradient-to-r from-[#0B4F6C] to-[#159A9C] text-white shadow-lg hover:shadow-xl active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4" /> Submit for Career Identity</>}
                        </button>
                        {submitError && <p className="mt-3 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {submitError}</p>}
                    </div>
                );
            case 'submitted':
                return (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4"><Clock className="h-8 w-8 text-blue-600" /></div>
                        <h2 className="text-lg font-bold text-slate-900 mb-2">Submission Received</h2>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">Our team has received your request and is preparing your Career Identity. We'll notify you when it's ready.</p>
                    </div>
                );
            case 'in_progress':
                return (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4"><RefreshCw className="h-8 w-8 text-purple-600 animate-spin" /></div>
                        <h2 className="text-lg font-bold text-slate-900 mb-2">In Progress</h2>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">Our team is currently creating your Career Identity. This usually takes 1–2 business days.</p>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div><h1 className="text-xl font-bold text-slate-900">Career Identity</h1><p className="text-sm text-slate-500">Premium Profile Dashboard</p></div>
                    <button onClick={() => navigate('/')} className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Back to Home</button>
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
                    <ResumeWorkspace user={user} frozen={isFrozen} />
                    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
                        <div className="border-t border-slate-200 pt-8 mb-6">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" /> Career Identity Profile</h2>
                            <p className="text-sm text-slate-500 mt-1">Manage your premium Career Identity profile.</p>
                        </div>
                        <div className="space-y-6">
                            {renderWorkflowSection()}

                            {derived && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Profile Summary</h3>
                                    <div className="space-y-2 text-sm">
                                        {derived.candidateName && <p><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-900">{derived.candidateName}</span></p>}
                                        {derived.jobTitle && <p><span className="text-slate-500">Title:</span> <span className="font-medium text-slate-900">{derived.jobTitle}</span></p>}
                                        {derived.email && <p><span className="text-slate-500">Email:</span> <span className="font-medium text-slate-900">{derived.email}</span></p>}
                                        {derived.resumeUrl && <p><span className="text-slate-500">Resume:</span> <span className="text-emerald-600 font-medium">Uploaded</span></p>}
                                        {derived.videoUrl && <p><span className="text-slate-500">Video:</span> <span className="text-emerald-600 font-medium">Recorded</span></p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </>
            )}
        </div>
    );
}