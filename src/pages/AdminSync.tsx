import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { showToast } from '../components/ui/toast';

const AdminSync = () => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [manualEmail, setManualEmail] = useState('');
    const [manualName, setManualName] = useState('');
    const [manualLoading, setManualLoading] = useState(false);
    const [backfillLoading, setBackfillLoading] = useState(false);

    const runSync = async () => {
        setLoading(true);
        setLogs(prev => ["Starting sync...", ...prev]);

        try {
            const { data, error } = await supabase.functions.invoke('sync-crm-users');

            if (error) throw error;

            setLogs(prev => [
                `✅ Sync Completed!`,
                `Created: ${data.summary.created}`,
                `Already Exists: ${data.summary.alreadyExists}`,
                `Errors: ${data.summary.errors}`,
                ...prev
            ]);

            if (data.summary.created > 0) {
                showToast(`Successfully created ${data.summary.created} new users!`, 'success');
            } else {
                showToast('Sync finished. No new users found.', 'info');
            }

        } catch (err: any) {
            console.error(err);
            setLogs(prev => [`❌ Error: ${err.message}`, ...prev]);
            showToast('Failed to run sync.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const createManualUser = async () => {
        if (!manualEmail) return showToast("Email is required", "error");
        setManualLoading(true);
        setLogs(prev => [`Starting manual creation for ${manualEmail}...`, ...prev]);

        try {
            const { data, error } = await supabase.functions.invoke('sync-crm-users', {
                body: {
                    action: 'manual_create',
                    email: manualEmail,
                    name: manualName
                }
            });

            if (error) throw error;

            const result = data.results[0];
            setLogs(prev => [
                `✅ Manual Creation Result:`,
                `Status: ${result?.status}`,
                `User ID: ${result?.user_id || 'N/A'}`,
                ...prev
            ]);

            if (result?.status === 'created') {
                showToast(`User ${manualEmail} created!`, 'success');
                setManualEmail('');
                setManualName('');
            } else if (result?.status === 'already_exists') {
                showToast(`User ${manualEmail} already exists.`, 'warning');
            } else {
                showToast(`Failed: ${result?.error}`, 'error');
            }

        } catch (err: any) {
            console.error(err);
            setLogs(prev => [`❌ Error: ${err.message}`, ...prev]);
            showToast('Failed to create user.', 'error');
        } finally {
            setManualLoading(false);
        }
    };

    const backfillResumes = async () => {
        setBackfillLoading(true);
        setLogs(prev => ["🚀 Starting Resume Path Backfill...", ...prev]);
        let totalProcessed = 0;
        let totalUpdated = 0;

        try {
            // 1. Fetch records missing resumes
            const [{ data: crmRecords }, { data: regRecords }] = await Promise.all([
                supabase.from('crm_job_requests').select('id, email').is('resume_url', null),
                supabase.from('job_requests').select('id, candidate_email, email').is('resume_path', null)
            ]);

            // Helper to sync a single record
            const syncRecord = async (id: string, email: string, table: 'crm_job_requests' | 'job_requests') => {
                if (!email) return;
                try {
                    const response = await fetch(`/api/proxy-applywizz?email=${encodeURIComponent(email.trim().toLowerCase())}`);
                    if (response.ok) {
                        const json = await response.json();
                        const userData = Array.isArray(json) ? json[0] : json;
                        const vResumeUrl = userData?.data?.resume?.pdf_path?.[0] || userData?.resume?.pdf_path?.[0];

                        if (vResumeUrl) {
                            const col = table === 'crm_job_requests' ? 'resume_url' : 'resume_path';
                            const { error } = await supabase.from(table).update({ [col]: vResumeUrl }).eq('id', id);
                            if (error) console.error(`Failed to update ${id} in ${table}:`, error);
                            return !error;
                        }
                    }
                } catch (e) {
                    console.error(`Error syncing ${email}:`, e);
                }
                return false;
            };

            // Process CRM records
            if (crmRecords) {
                for (const rec of crmRecords) {
                    totalProcessed++;
                    const success = await syncRecord(rec.id, rec.email, 'crm_job_requests');
                    if (success) totalUpdated++;
                }
            }

            // Process Regular records
            if (regRecords) {
                for (const rec of regRecords) {
                    totalProcessed++;
                    const emailString = (rec as any).candidate_email || (rec as any).email;
                    const success = await syncRecord(rec.id, emailString, 'job_requests');
                    if (success) totalUpdated++;
                }
            }

            setLogs(prev => [
                `✅ Backfill Completed!`,
                `Processed: ${totalProcessed}`,
                `Updated: ${totalUpdated}`,
                ...prev
            ]);
            showToast(`Backfill complete: Updated ${totalUpdated} records.`, 'success');

        } catch (err: any) {
            console.error(err);
            setLogs(prev => [`❌ Backfill Error: ${err.message}`, ...prev]);
            showToast('Backfill failed.', 'error');
        } finally {
            setBackfillLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Manual User Creation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-gray-600 text-sm">
                        Create a single user immediately with default password "Applywizz@123".
                    </p>
                    <div className="grid gap-4">
                        <input
                            type="email"
                            placeholder="User Email"
                            value={manualEmail}
                            onChange={(e) => setManualEmail(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <input
                            type="text"
                            placeholder="Full Name (Optional)"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <Button
                            onClick={createManualUser}
                            disabled={manualLoading || !manualEmail}
                            className="w-full"
                        >
                            {manualLoading ? 'Creating...' : 'Create User'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Resume Path Backfill</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-gray-600 text-sm">
                        Scans all existing requests that are missing a resume path and attempts to find them via the external API.
                    </p>
                    <Button
                        onClick={backfillResumes}
                        disabled={backfillLoading}
                        variant="secondary"
                        className="w-full flex items-center gap-2"
                    >
                        {backfillLoading ? 'Processing...' : 'Sync Missing Resumes 🔁'}
                    </Button>
                </CardContent>
            </Card>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Resume Path Backfill</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-gray-600 text-sm">
                        Scans all existing requests that are missing a resume path and attempts to find them via the external API.
                    </p>
                    <Button
                        onClick={backfillResumes}
                        disabled={backfillLoading}
                        variant="secondary"
                        className="w-full flex items-center gap-2"
                    >
                        {backfillLoading ? 'Processing...' : 'Sync Missing Resumes 🔁'}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>CRM User Sync (Bulk)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-gray-600">
                        Click the button below to manually check for new CRM users, create their accounts, and send welcome emails.
                    </p>

                    <Button
                        onClick={runSync}
                        disabled={loading}
                        className="w-full h-12 text-lg"
                    >
                        {loading ? 'Syncing...' : 'Run Sync Now 🔄'}
                    </Button>

                    <div className="bg-gray-100 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm">
                        {logs.length === 0 ? (
                            <span className="text-gray-400">Logs will appear here...</span>
                        ) : (
                            logs.map((log, i) => <div key={i} className="mb-1">{log}</div>)
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminSync;
