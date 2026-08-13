import React, { useState, useCallback } from 'react';
import { ResumeModals } from '../components/ResumeModals';
import type { CareerIdentityContent, CareerIdentityProfileStatus } from '../../../types/careerIdentity';
import { Save, Eye, CheckCircle, RefreshCw, Plus, X, Camera, AlertCircle } from 'lucide-react';

interface EditorProps {
    initialContent: CareerIdentityContent;
    initialThemeId: string | null;
    initialStatus: CareerIdentityProfileStatus;
    resumeId: string | null;
    onSave: (data: { content: CareerIdentityContent; themeId: string; status?: CareerIdentityProfileStatus; workflowStatus?: string }) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
    saveError: string | null;
}

function createId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export default function CareerIdentityAdminEditor({
    initialContent,
    initialThemeId,
    initialStatus,
    resumeId,
    onSave,
    onCancel,
    saving,
    saveError: externalSaveError,
}: EditorProps) {
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

    const saveError = externalSaveError || localSaveError;

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
        // Always use the fixed theme
        await onSave({ content: contentToSave, themeId: initialThemeId || 'aurora', workflowStatus, status });
    };

    const handlePreview = () => {
        // Store the latest unsaved edits in localStorage before previewing
        localStorage.setItem('ci_preview_content', JSON.stringify(content));
        localStorage.setItem('ci_preview_theme', initialThemeId || 'aurora');
        localStorage.setItem('ci_preview_avatar', selectedAvatar || '');
        window.open(`/career-identity/${resumeId}?preview=true`, '_blank', 'noopener,noreferrer');
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

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => handleAction()} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0B4F6C] text-white rounded-lg text-sm font-medium hover:bg-[#0a3d54] transition-colors disabled:opacity-50">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Draft
                </button>
                <button onClick={handlePreview}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-[#0B4F6C] text-[#0B4F6C] rounded-lg text-sm font-medium hover:bg-[#0B4F6C]/5 transition-colors">
                    <Eye className="w-4 h-4" /> Preview
                </button>
                {initialStatus === 'draft' && (
                    <button onClick={() => handleAction('ready_for_review')} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        Mark Ready
                    </button>
                )}
                {initialStatus === 'draft' && (
                    <button onClick={() => handleAction(undefined, 'published')} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Publish
                    </button>
                )}
                <button onClick={onCancel} disabled={saving}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Cancel
                </button>
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
                            <button type="button" onClick={() => setIsAvatarModalOpen(true)}
                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-200">
                                Choose Avatar
                            </button>
                            {selectedAvatar && (
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
                <button onClick={() => handleAction()} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0B4F6C] text-white rounded-lg text-sm font-medium hover:bg-[#0a3d54] transition-colors disabled:opacity-50">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Draft
                </button>
                {initialStatus === 'draft' && (
                    <button onClick={() => handleAction('ready_for_review')} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        Mark Ready
                    </button>
                )}
                <button onClick={onCancel} disabled={saving}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Cancel
                </button>
            </div>

            {/* Avatar Selection Modal */}
            <ResumeModals
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
                initialGender={displayName.toLowerCase().endsWith('a') || displayName.toLowerCase().includes('girl') ? 'girl' : 'boy'}
            />
        </div>
    );
}