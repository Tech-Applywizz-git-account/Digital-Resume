import { useState } from 'react';
import { UserCircle } from 'lucide-react';
import { CAREER_IDENTITY_THEMES } from '../themes/themeRegistry';
import { savePublishedAppearance, type PublishedAppearance } from '../services/careerIdentityService';

export function PublishedAppearanceEditor({ appearance, name, onClose, onSaved }: {
    appearance: PublishedAppearance;
    name: string;
    onClose: () => void;
    onSaved: (appearance: PublishedAppearance) => void;
}) {
    const [themeId, setThemeId] = useState(appearance.themeId);
    const [avatar, setAvatar] = useState(appearance.avatar);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const theme = CAREER_IDENTITY_THEMES.find(option => option.key === themeId);
    const changed = themeId !== appearance.themeId || avatar !== appearance.avatar;

    async function save() {
        if (saving || !changed) return;
        setSaving(true);
        setError('');
        try {
            await savePublishedAppearance({
                submissionId: appearance.submissionId,
                themeId,
                ...(avatar !== appearance.avatar ? { avatar } : {}),
            });
            onSaved({ ...appearance, themeId, avatar });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save your appearance. Try again.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <section aria-labelledby="ci-appearance-heading" className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
            <h2 id="ci-appearance-heading" className="font-semibold text-slate-900">Edit Appearance</h2>
            <div className="mt-4 flex flex-wrap gap-5">
                <div className="min-w-0 flex-1 space-y-4">
                    <fieldset disabled={saving}>
                        <legend className="mb-2 text-sm font-medium">Theme</legend>
                        <div className="flex flex-wrap gap-2">
                            {CAREER_IDENTITY_THEMES.map(option => (
                                <button key={option.key} type="button" aria-pressed={themeId === option.key}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm aria-pressed:border-teal-700 aria-pressed:bg-teal-50"
                                    onClick={() => setThemeId(option.key)}>{option.name}</button>
                            ))}
                        </div>
                    </fieldset>
                    <fieldset disabled={saving}>
                        <legend className="mb-2 text-sm font-medium">Avatar</legend>
                        <div className="flex flex-wrap gap-2">
                            {Array.from({ length: 16 }, (_, index) => {
                                const path = `/Avatar_profile/${index + 1}.jpg`;
                                return <button key={path} type="button" aria-label={`Avatar ${index + 1}`}
                                    aria-pressed={avatar === path} onClick={() => setAvatar(path)}
                                    className="rounded-lg border-2 border-transparent p-0.5 aria-pressed:border-teal-700">
                                    <img src={path} alt="" className="h-10 w-10 rounded-md object-cover" />
                                </button>;
                            })}
                        </div>
                        {avatar && <button type="button" onClick={() => setAvatar(null)}
                            className="mt-2 text-sm text-slate-600 underline">Remove avatar</button>}
                    </fieldset>
                </div>
                <div className="w-full rounded-xl border p-4 sm:w-48" style={{
                    backgroundColor: theme?.swatch.bg, color: theme?.swatch.text, borderColor: theme?.swatch.accent,
                }}>
                    <p className="mb-3 text-xs font-medium">Appearance preview</p>
                    {avatar ? <img src={avatar} alt="Selected avatar" className="h-14 w-14 rounded-full object-cover" />
                        : <UserCircle aria-hidden="true" className="h-14 w-14" />}
                    <p className={`mt-2 break-words font-semibold ${themeId === 'atlas' ? 'font-serif' : ''}`}>{name}</p>
                </div>
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={saving || !changed} onClick={save}
                    className="rounded-lg bg-[#0B4F6C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save to live profile'}
                </button>
                <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            </div>
        </section>
    );
}
