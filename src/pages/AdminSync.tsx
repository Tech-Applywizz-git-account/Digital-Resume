import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { showToast } from '../components/ui/toast';

const AdminSync = () => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

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

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>CRM User Sync (Manual)</CardTitle>
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
