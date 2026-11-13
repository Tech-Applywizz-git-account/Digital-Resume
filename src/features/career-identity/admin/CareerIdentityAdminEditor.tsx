import React, { useState, useCallback, useEffect } from 'react';
import { ResumeModals } from '../components/ResumeModals';
import type { CareerIdentityContent, CareerIdentityProfileStatus } from '../../../types/careerIdentity';
import { CAREER_IDENTITY_THEMES, CareerIdentityThemeKey } from '../themes/themeRegistry';
import { Save, Eye, CheckCircle, RefreshCw, Plus, X, Camera, AlertCircle, Sparkles, Palette, ExternalLink } from 'lucide-react';
import { apiUrl } from '../../../lib/apiBase';
import { supabase } from '../../../integrations/supabase/client';

interface EditorProps {
    userId?: string;
    submissionId?: string;
    initialContent: CareerIdentityContent;
    initialThemeId: string | null;
    initialStatus: CareerIdentityProfileStatus;
    resumeId: string | null;
    resumeUrl: string | null;
    videoUrl: string | null;
    canPublish: boolean;
    appearanceLocked: boolean;
    onSave: (data: { content: CareerIdentityContent; themeId: string; status?: CareerIdentityProfileStatus; workflowStatus?: string }) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
    saveError: string | null;
}

function createId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export default function CareerIdentityAdminEditor({
    userId,
    submissionId,
    initialContent,
    initialThemeId,
    initialStatus,
    resumeId,
    resumeUrl,
    videoUrl,
    canPublish,
    appearanceLocked,
    onSave,
    onCancel,
    saving,
    saveError: externalSaveError,
}: EditorProps) {
    const [selectedThemeId, setSelectedThemeId] = useState<CareerIdentityThemeKey>(() => {
        if (initialThemeId && ['aurora', 'zenith', 'atlas'].includes(initialThemeId)) {
            return initialThemeId as CareerIdentityThemeKey;
        }
        return 'aurora';
    });

    useEffect(() => {
        if (initialThemeId && ['aurora', 'zenith', 'atlas'].includes(initialThemeId)) {
            setSelectedThemeId(initialThemeId as CareerIdentityThemeKey);
        }
    }, [initialThemeId]);

    const [content, setContent] = useState<CareerIdentityContent>(() => ({
        hero: initialContent.hero ?? {},
        about: initialContent.about ?? '',
        education: initialContent.education ?? [],
        skills: initialContent.skills ?? [],
        contact: initialContent.contact ?? {},
    }));
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(initialContent.hero?.profileImageUrl || null);
    const [skillInput, setSkillInput] = useState('');
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [localSaveError, setLocalSaveError] = useState<string | null>(null);
    const [autoFilling, setAutoFilling] = useState(false);
    const [autoFillFeedback, setAutoFillFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const saveError = externalSaveError || localSaveError;

    const handleAutoFill = async () => {
        if (!userId) {
            setLocalSaveError('User ID is missing for auto-fill');
            return;
        }
        setAutoFilling(true);
        setAutoFillFeedback(null);
        setLocalSaveError(null);
        try {
            let { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                const refreshed = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
                session = refreshed.data.session;
            }
            const adminEmail =
                sessionStorage.getItem('admin_email') ||
                session?.user?.email ||
                localStorage.getItem('admin_email') ||
                localStorage.getItem('user_email');
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...(submissionId ? { 'X-CI-Submission-Id': submissionId } : {}),
            };
            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
            if (adminEmail) headers['x-admin-email'] = adminEmail;

            if (!session?.access_token && !adminEmail) throw new Error('Not authenticated');

            const res = await fetch(apiUrl(`/api/v1/career-identity/admin/requests/${userId}/auto-fill`), {
                method: 'POST',
                headers,
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message || body?.message || `Auto-fill failed (${res.status})`);
            }

            const body = await res.json();
            const autoContent = body?.data?.content as CareerIdentityContent;
            const newThemeId = body?.data?.themeId as CareerIdentityThemeKey | undefined;
            if (!autoContent) throw new Error('No content returned from resume parser');

            // If an avatar was assigned and none is currently selected, select it
            const assignedAvatar = autoContent.hero?.profileImageUrl;
            if (!appearanceLocked && assignedAvatar && !selectedAvatar) {
                setSelectedAvatar(assignedAvatar);
            }

            if (!appearanceLocked && newThemeId && !selectedThemeId) {
                setSelectedThemeId(newThemeId);
            }

            // Populate React form state in-memory (DB is NOT touched)
            setContent(prev => ({
                ...prev,
                hero: {
                    ...(prev.hero || {}),
                    ...(autoContent.hero || {}),
                    profileImageUrl: appearanceLocked ? selectedAvatar ?? undefined : selectedAvatar || assignedAvatar || prev.hero?.profileImageUrl,
                },
                about: submissionId ? (autoContent.about ?? '') : (autoContent.about || prev.about || ''),
                skills: submissionId ? (autoContent.skills ?? []) : (autoContent.skills?.length ? autoContent.skills : (prev.skills ?? [])),
                education: submissionId ? (autoContent.education ?? []) : (autoContent.education?.length ? autoContent.education : (prev.education ?? [])),
                contact: {
                    ...(prev.contact || {}),
                    ...(autoContent.contact || {}),
                },
            }));

            setAutoFillFeedback({
                type: 'success',
                message: 'Auto-fill complete. Review the fields and click Save Draft when ready.',
            });
            setValidationErrors([]);
        } catch (err: any) {
            console.error('[AutoFill] Failed to auto-fill:', err);
            setAutoFillFeedback({
                type: 'error',
                message: err?.message || 'Failed to auto-fill from resume',
            });
        } finally {
            setAutoFilling(false);
        }
    };

    const updateContent = useCallback((patch: Partial<CareerIdentityContent>) => {
        setContent(prev => ({ ...prev, ...patch }));
        setLocalSaveError(null);
    }, []);

    const handleHeroChange = useCallback((key: string, value: string) => {
        setContent(prev => ({
            ...prev,
            hero: { ...(prev.hero || {}), [key]: value },
        }));
        setLocalSaveError(null);
    }, []);

    const handleContactChange = useCallback((key: string, value: string) => {
        setContent(prev => ({
            ...prev,
            contact: { ...(prev.contact || {}), [key]: value },
        }));
        setLocalSaveError(null);
    }, []);

    const handleAvatarSelect = useCallback((path: string) => {
        setSelectedAvatar(path);
        setIsAvatarModalOpen(false);
    }, []);

    const handleAction = async (workflowStatus?: string, status?: CareerIdentityProfileStatus) => {
        const errors: string[] = [];
        if (!content.hero?.fullName?.trim()) errors.push('Full Name is required');
        if (!content.hero?.headline?.trim()) errors.push('Professional Headline is required');
        if (!content.about?.trim()) errors.push('About Me is required');
        if (!content.skills?.length) errors.push('At least one Core Skill is required');
        setValidationErrors(errors);
        if (errors.length > 0) return;
        setLocalSaveError(null);
        // Persist avatar into content.hero.profileImageUrl
        const contentToSave = { ...content };
        if (selectedAvatar) {
            contentToSave.hero = { ...(contentToSave.hero || {}), profileImageUrl: selectedAvatar };
        } else {
            // Remove profileImageUrl when avatar is cleared
            if (contentToSave.hero?.profileImageUrl !== undefined) {
                const { profileImageUrl, ...rest } = contentToSave.hero;
                contentToSave.hero = rest;
            }
        }
        // Save candidate's selected theme
        await onSave({ content: contentToSave, themeId: selectedThemeId, workflowStatus, status });
    };

    const handlePreview = () => {
        const previewId = crypto.randomUUID();
        const storageKey = `ci_preview_${previewId}`;
        localStorage.setItem(storageKey, JSON.stringify({
            content, theme: selectedThemeId, avatar: selectedAvatar, resumeUrl, videoUrl,
        }));
        window.open(`/career-identity/${resumeId || 'preview'}?preview=true&previewId=${previewId}`, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => localStorage.removeItem(storageKey), 60_000);
    };

    const addSkill = () => {
        const name = skillInput.trim();
        if (!name) return;
        if ((content.skills || []).some(s => s.name.toLowerCase() === name.toLowerCase())) return;
        updateContent({
            skills: [...(content.skills || []), { id: createId(), name }],
        });
        setSkillInput('');
    };

    const removeSkill = (id: string) => {
        updateContent({
            skills: (content.skills || []).filter(s => s.id !== id),
        });
    };

    const displayName = content.hero?.fullName || 'Professional';

    return (
        <div className="space-y-6">
            {/* Validation Errors */}
            {validationErrors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-bold text-red-700 uppercase tracking-widest mb-2">Please fix the following:</p>
                    <ul className="space-y-1">
                        {validationErrors.map((err, i) => (
                            <li key={i} className="text-sm text-red-600 flex items-center gap-2">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {err}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {saveError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                    <X className="w-4 h-4" /> {saveError}
                </div>
            )}

            {autoFillFeedback && (
                <div className={`p-4 rounded-lg text-sm flex items-center justify-between gap-3 ${
                    autoFillFeedback.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                    <div className="flex items-center gap-2">
                        {autoFillFeedback.type === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span>{autoFillFeedback.message}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAutoFillFeedback(null)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
                {resumeUrl && (
                    <a href={resumeUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        {submissionId ? 'Open Submitted Resume' : 'Open Resume'}
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                )}
                <button
                    type="button"
                    onClick={handleAutoFill}
                    disabled={saving || autoFilling}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm disabled:opacity-50"
                    title={submissionId ? 'Fill the form using the submitted resume' : 'Fill the form using the candidate’s resume'}
                >
                    {autoFilling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-100" />}
                    ⚡ Auto-Fill from Resume
                </button>
                <button onClick={() => handleAction()} disabled={saving || autoFilling}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0B4F6C] text-white rounded-lg text-sm font-medium hover:bg-[#0a3d54] transition-colors disabled:opacity-50">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Draft
                </button>
                <button onClick={handlePreview} disabled={saving || autoFilling}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-[#0B4F6C] text-[#0B4F6C] rounded-lg text-sm font-medium hover:bg-[#0B4F6C]/5 transition-colors">
                    <Eye className="w-4 h-4" /> Preview
                </button>
                {initialStatus === 'draft' && (
                    <button onClick={() => handleAction('ready_for_review')} disabled={saving || autoFilling}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        Mark Ready
                    </button>
                )}
                {initialStatus === 'draft' && canPublish && (
                    <button onClick={() => handleAction(undefined, 'published')} disabled={saving || autoFilling}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Publish
                    </button>
                )}
                <button onClick={onCancel} disabled={saving || autoFilling}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Cancel
                </button>
            </div>

            {/* Theme Selector Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                            <Palette size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">Career Identity Theme</h2>
                            <p className="text-xs text-slate-500">{appearanceLocked ? 'Managed by the client on their published profile' : 'Select a theme for this profile'}</p>
                        </div>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 capitalize self-start sm:self-auto">
                        Active: {CAREER_IDENTITY_THEMES.find(t => t.key === selectedThemeId)?.name || selectedThemeId}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {!appearanceLocked && CAREER_IDENTITY_THEMES.map((theme) => {
                        const isSelected = selectedThemeId === theme.key;
                        return (
                            <div
                                key={theme.key}
                                onClick={() => setSelectedThemeId(theme.key)}
                                className={`cursor-pointer rounded-xl border-2 p-4 transition-all relative flex flex-col justify-between ${
                                    isSelected
                                        ? 'border-[#0B4F6C] bg-sky-50/20 shadow-md ring-2 ring-[#0B4F6C]/15'
                                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                            isSelected ? 'bg-[#0B4F6C] text-white' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {theme.badgeLabel}
                                        </span>
                                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                                            <span
                                                className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block shadow-xs"
                                                style={{ backgroundColor: theme.swatch.primary }}
                                                title="Primary"
                                            />
                                            <span
                                                className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block shadow-xs"
                                                style={{ backgroundColor: theme.swatch.accent }}
                                                title="Accent"
                                            />
                                            <span
                                                className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block shadow-xs"
                                                style={{ backgroundColor: theme.swatch.bg }}
                                                title="Background"
                                            />
                                        </div>
                                    </div>

                                    <h3 className={`text-sm font-bold mb-1.5 ${isSelected ? 'text-[#0B4F6C]' : 'text-slate-900'}`}>
                                        {theme.name}
                                    </h3>
                                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                        {theme.description}
                                    </p>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-slate-500">
                                        {theme.key === 'atlas' ? 'Serif Headings' : theme.key === 'zenith' ? 'Glassmorphic' : 'Modern Corporate'}
                                    </span>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                        isSelected ? 'border-[#0B4F6C] bg-[#0B4F6C] text-white' : 'border-slate-300'
                                    }`}>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 1. Identity Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Identity</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Avatar */}
                    <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-500 font-medium mb-2">Current Avatar</label>
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                {selectedAvatar ? (
                                    <img src={selectedAvatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <Camera size={24} className="text-slate-400" />
                                )}
                            </div>
                            {!appearanceLocked && <button type="button" onClick={() => setIsAvatarModalOpen(true)}
                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-200">
                                Choose Avatar
                            </button>}
                            {!appearanceLocked && selectedAvatar && (
                                <button type="button" onClick={() => setSelectedAvatar(null)}
                                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm transition-colors">
                                    Remove Avatar
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 font-medium mb-1">Full Name *</label>
                        <input value={content.hero?.fullName || ''}
                            onChange={(e) => handleHeroChange('fullName', e.target.value)}
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none ${!content.hero?.fullName && validationErrors.length > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                            placeholder="John Doe" />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 font-medium mb-1">Professional Headline *</label>
                        <input value={content.hero?.headline || ''}
                            onChange={(e) => handleHeroChange('headline', e.target.value)}
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none ${!content.hero?.headline && validationErrors.length > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                            placeholder="Senior Software Engineer" />
                    </div>
                    <div className="flex items-end gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={content.hero?.verified || false}
                                onChange={(e) => handleHeroChange('verified', e.target.checked ? 'true' : '')}
                                className="rounded border-slate-300 text-[#0B4F6C] focus:ring-[#0B4F6C]" />
                            <span className="text-sm text-slate-600">Verified</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={content.hero?.openToRelocate || false}
                                onChange={(e) => handleHeroChange('openToRelocate', e.target.checked ? 'true' : '')}
                                className="rounded border-slate-300 text-[#0B4F6C] focus:ring-[#0B4F6C]" />
                            <span className="text-sm text-slate-600">Open to Relocate</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* 2. About Me */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">About Me *</h2>
                    <span className={`text-xs font-medium ${(content.about || '').length > 350 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {(content.about || '').length} / 400 characters
                    </span>
                </div>
                <textarea value={content.about || ''}
                    onChange={(e) => {
                        if (e.target.value.length <= 400) updateContent({ about: e.target.value });
                    }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none resize-none ${!content.about && validationErrors.length > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                    rows={4} placeholder="Write a short professional introduction..." />
            </div>

            {/* 3. Core Skills */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Core Skills *</h2>
                <div className="flex flex-wrap gap-2 mb-3">
                    {(content.skills || []).map((skill) => (
                        <span key={skill.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
                            {skill.name}
                            <button type="button" onClick={() => removeSkill(skill.id)}
                                className="text-blue-400 hover:text-red-500 transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none"
                        placeholder="Type a skill and press Enter"
                    />
                    <button type="button" onClick={addSkill}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors border border-slate-200">
                        Add
                    </button>
                </div>
                {!content.skills?.length && validationErrors.length > 0 && (
                    <p className="mt-2 text-xs text-red-500">Add at least one skill</p>
                )}
            </div>

            {/* 4. Education */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Education</h2>
                <div className="space-y-3">
                    {(content.education || []).length === 0 && (
                        <p className="text-sm text-slate-400 italic">No education added yet.</p>
                    )}
                    {(content.education || []).map((edu, index) => (
                        <div key={edu.id} className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-600">Degree {index + 1}</span>
                                <button type="button" onClick={() => {
                                    const updated = [...(content.education || [])];
                                    updated.splice(index, 1);
                                    updateContent({ education: updated });
                                }} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input value={edu.degree || ''} onChange={(e) => {
                                    const updated = [...(content.education || [])];
                                    updated[index] = { ...updated[index], degree: e.target.value };
                                    updateContent({ education: updated });
                                }} placeholder="Degree (e.g. MS in CS)"
                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none" />
                                <input value={edu.institution || ''} onChange={(e) => {
                                    const updated = [...(content.education || [])];
                                    updated[index] = { ...updated[index], institution: e.target.value };
                                    updateContent({ education: updated });
                                }} placeholder="Institution"
                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none" />
                                <input value={edu.fieldOfStudy || ''} onChange={(e) => {
                                    const updated = [...(content.education || [])];
                                    updated[index] = { ...updated[index], fieldOfStudy: e.target.value };
                                    updateContent({ education: updated });
                                }} placeholder="Year"
                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none" />
                            </div>
                        </div>
                    ))}
                    <button type="button" onClick={() => {
                        updateContent({ education: [...(content.education || []), { id: createId(), institution: '', degree: '' }] });
                    }} className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg text-sm font-medium hover:border-[#0B4F6C] hover:text-[#0B4F6C] transition-colors w-full justify-center">
                        <Plus className="w-4 h-4" /> Add Education
                    </button>
                </div>
            </div>

            {/* 5. Contact Information */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Contact Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-500 font-medium mb-1">Email</label>
                        <input value={content.contact?.email || ''}
                            onChange={(e) => handleContactChange('email', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 font-medium mb-1">Phone</label>
                        <input value={content.contact?.phone || ''}
                            onChange={(e) => handleContactChange('phone', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 font-medium mb-1">Location</label>
                        <input value={content.contact?.location || ''}
                            onChange={(e) => handleContactChange('location', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 font-medium mb-1">LinkedIn URL</label>
                        <input value={content.contact?.linkedin || ''}
                            onChange={(e) => handleContactChange('linkedin', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none" />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-500 font-medium mb-1">Portfolio URL (Optional)</label>
                        <input value={content.contact?.website || ''}
                            onChange={(e) => handleContactChange('website', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/10 focus:border-[#0B4F6C] outline-none"
                            placeholder="https://yourportfolio.com" />
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-3 flex-wrap pt-2 pb-8">
                <button
                    type="button"
                    onClick={handleAutoFill}
                    disabled={saving || autoFilling}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm disabled:opacity-50"
                    title={submissionId ? 'Fill the form using the submitted resume' : 'Fill the form using the candidate’s resume'}
                >
                    {autoFilling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-100" />}
                    ⚡ Auto-Fill from Resume
                </button>
                <button onClick={() => handleAction()} disabled={saving || autoFilling}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0B4F6C] text-white rounded-lg text-sm font-medium hover:bg-[#0a3d54] transition-colors disabled:opacity-50">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Draft
                </button>
                {initialStatus === 'draft' && (
                    <button onClick={() => handleAction('ready_for_review')} disabled={saving || autoFilling}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        Mark Ready
                    </button>
                )}
                <button onClick={onCancel} disabled={saving || autoFilling}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Cancel
                </button>
            </div>

            {/* Avatar Selection Modal */}
            <ResumeModals
                themeId={selectedThemeId}
                isHireMeModalOpen={false} setIsHireMeModalOpen={() => { }}
                isContactModalOpen={false} setIsContactModalOpen={() => { }}
                isScheduleModalOpen={false} setIsScheduleModalOpen={() => { }}
                displayName={displayName} displayTitle={content.hero?.headline || ''} displayEmail=""
                candidatePhone={null} isHumanMode={false}
                handleDownloadResume={() => { }} handleEmailCandidate={() => { }} handleWhatsAppCandidate={() => { }}
                handleScheduleSubmit={async () => { }} formData={{}} setFormData={() => { }}
                scheduleStep={1} setScheduleStep={() => { }} formStatus="idle"
                isAvatarModalOpen={isAvatarModalOpen}
                setIsAvatarModalOpen={setIsAvatarModalOpen}
                onAvatarSelect={handleAvatarSelect}
                initialGender={content.hero?.gender || (displayName.toLowerCase().endsWith('a') || displayName.toLowerCase().includes('female') ? 'Female' : 'Male')}
            />
        </div>
    );
}
