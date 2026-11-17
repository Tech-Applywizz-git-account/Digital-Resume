import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../integrations/supabase/client';
import { adminRequest, getAdminRole } from './adminApi';

interface Overview {
    totals: { total: number; digitalResume: number; careerIdentity: number; clarityActive: number };
    digitalResume: { noResume: number; incomplete: number; completed: number };
    delivery: { notSubmitted: number; awaitingPublication: number; published: number; pendingUpdates: number };
    activity: { upgrades: number; firstPublications: number; medianPublishHours: number | null; timedPublications: number };
    credits: { remaining: number; accountsWithBalance: number };
    calculatedAt: string;
}

const percentage = (part: number, total: number) => total ? `${Math.round(part / total * 100)}%` : '—';
const number = (value: number) => value.toLocaleString();

function Breakdown({ title, entries, total, pendingUpdates }: {
    title: string;
    entries: [string, number][];
    total: number;
    pendingUpdates?: number;
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{title}</h2>
            <dl className="mt-4 space-y-4">
                {entries.map(([label, count]) => (
                    <div key={label}>
                        <div className="flex justify-between gap-3 text-sm">
                            <dt className="text-slate-700">{label}</dt>
                            <dd className="font-semibold tabular-nums">{number(count)} <span className="font-normal text-slate-500">· {percentage(count, total)}</span></dd>
                        </div>
                        <div aria-hidden="true" className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-teal-600" style={{ width: total ? `${count / total * 100}%` : '0%' }} />
                        </div>
                    </div>
                ))}
            </dl>
            {pendingUpdates !== undefined && (
                <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm">
                    {pendingUpdates > 0 ? (
                        <>
                            <Clock3 size={16} aria-hidden="true" className="shrink-0 text-amber-700" />
                            <span className="text-slate-700">Published profiles with a pending update</span>
                            <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold tabular-nums text-amber-800">
                                {number(pendingUpdates)}
                            </span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={16} aria-hidden="true" className="shrink-0 text-teal-700" />
                            <span className="text-slate-600">No pending updates to published profiles</span>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}

export default function BusinessOverview() {
    const { logout } = useAuthContext();
    const [overview, setOverview] = useState<Overview | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [redirect, setRedirect] = useState('');
    const [verifiedSuperAdmin, setVerifiedSuperAdmin] = useState(false);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            setLoading(true);
            setError('');
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (controller.signal.aborted) return;
                if (!session) { setRedirect('/DigitalResumeLogin'); return; }
                const role = await getAdminRole(session.access_token);
                if (controller.signal.aborted) return;
                if (role !== 'super_admin') {
                    setRedirect(role === 'admin' ? '/digital-resume-dashboard' : '/auth');
                    return;
                }
                setVerifiedSuperAdmin(true);
                const data = await adminRequest<Overview>('/business-overview', { signal: controller.signal }, session.access_token);
                if (!controller.signal.aborted) setOverview(data);
            } catch (err) {
                if (!controller.signal.aborted) {
                    setOverview(null);
                    setError(err instanceof Error ? err.message : 'Could not load the overview.');
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        void load();
        return () => controller.abort();
    }, [refresh]);

    if (redirect) return <Navigate to={redirect} replace />;
    const totals = overview?.totals;
    const delivery = overview?.delivery;
    const activity = overview?.activity;
    const clarityInactive = delivery && totals ? delivery.published - totals.clarityActive : 0;

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Business Overview</h1>
                        {overview && <p className="mt-1 text-sm text-slate-600">Last updated {new Date(overview.calculatedAt).toLocaleString()}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm font-medium">
                        {verifiedSuperAdmin && <Link to="/digital-resume-dashboard" className="rounded-lg bg-[#0B4F6C] px-4 py-2 text-white">Open Admin Dashboard</Link>}
                        <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-60">
                            <RefreshCw size={15} aria-hidden="true" /> {error ? 'Retry' : 'Refresh'}
                        </button>
                        <button type="button" onClick={async () => { await logout(); setRedirect('/DigitalResumeLogin'); }}
                            className="rounded-lg px-3 py-2 text-slate-700">Sign out</button>
                    </div>
                </header>
                {loading && <p role="status" className="text-sm text-slate-600">Loading business metrics…</p>}
                {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
                {overview && totals && delivery && activity && (
                    <>
                        <section aria-label="Client totals and Clarity adoption" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                            {[
                                ['Total clients', totals.total, 'Current DR and CI accounts'],
                                ['Digital Resume clients', totals.digitalResume, 'Current Digital Resume tier'],
                                ['Career Identity clients', totals.careerIdentity, 'Current Career Identity tier'],
                                ['Published CI with active Clarity', totals.clarityActive, `Of ${number(delivery.published)} published · ${percentage(totals.clarityActive, delivery.published)}`],
                                ['Published CI without active Clarity', clarityInactive, `Of ${number(delivery.published)} published · ${percentage(clarityInactive, delivery.published)}`],
                            ].map(([label, value, detail]) => (
                                <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
                                    <h2 className="text-sm font-medium text-slate-600">{label}</h2>
                                    <p className="mt-2 text-3xl font-bold tabular-nums text-[#0B4F6C]">{number(Number(value))}</p>
                                    <p className="mt-1 text-xs text-slate-600">{detail}</p>
                                </div>
                            ))}
                        </section>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Breakdown title="Digital Resume activation" total={totals.digitalResume} entries={[
                                ['No resume or video saved', overview.digitalResume.noResume],
                                ['Started but incomplete', overview.digitalResume.incomplete],
                                ['At least one completed', overview.digitalResume.completed],
                            ]} />
                            <Breakdown title="Career Identity delivery" total={totals.careerIdentity} pendingUpdates={delivery.pendingUpdates} entries={[
                                ['Not submitted', delivery.notSubmitted],
                                ['Awaiting first publication', delivery.awaitingPublication],
                                ['Published', delivery.published],
                            ]} />
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <section className="rounded-xl border border-slate-200 bg-white p-5">
                                <h2 className="font-semibold">Last 30 days</h2>
                                <dl className="mt-3 space-y-2 text-sm">
                                    <div className="flex justify-between gap-3"><dt>DR → CI upgrades activated</dt><dd className="font-semibold">{number(overview.activity.upgrades)}</dd></div>
                                    <div className="flex justify-between gap-3">
                                        <dt>
                                            First CI publications
                                            <span className="mt-0.5 block text-xs text-slate-600">First publications with a saved publish date in the last 30 days.</span>
                                        </dt>
                                        <dd className="font-semibold">{number(activity.firstPublications)}</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <dt>Median time to first publication</dt>
                                        <dd className="shrink-0 text-right font-semibold">
                                            {activity.medianPublishHours === null ? '—' : activity.medianPublishHours < 1
                                                ? `${number(Math.round(activity.medianPublishHours * 60))} min`
                                                : `${activity.medianPublishHours.toFixed(1)} h`}
                                            <span className="mt-0.5 block text-xs font-normal text-slate-600">
                                                {number(activity.timedPublications)} {activity.timedPublications === 1 ? 'publication' : 'publications'} timed
                                            </span>
                                        </dd>
                                    </div>
                                </dl>
                            </section>
                            <section className="rounded-xl border border-slate-200 bg-white p-5">
                                <h2 className="font-semibold">Available credits</h2>
                                <p className="mt-2 text-2xl font-bold text-[#0B4F6C]">{number(overview.credits.remaining)}</p>
                                <p className="mt-1 text-sm text-slate-600">Across {number(overview.credits.accountsWithBalance)} clients with a recorded balance</p>
                            </section>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
