import React from 'react';
import ResumeManagementConsole from '../features/resume-dashboard/components/ResumeManagementConsole';

/**
 * Tier 1 — Digital Resume Dashboard.
 *
 * Thin wrapper around the shared ResumeManagementConsole (see
 * src/features/resume-dashboard/components/ResumeManagementConsole.tsx).
 * Behavior is unchanged from before this file was extracted — this route,
 * its data, and every handler inside the console are identical to the
 * original DigitalResumeDashboard implementation.
 */
export default function DigitalResumeDashboard() {
    return <ResumeManagementConsole tier="digital_resume" title="Digital Resume CRM" />;
}