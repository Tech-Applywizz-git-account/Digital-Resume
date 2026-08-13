import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { isSafeUUID } from '../utils/uuidHelpers';
import {
  Menu,
  Loader2,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import ResumeWorkspace from '../features/resume-dashboard/components/ResumeWorkspace';
import { apiUrl } from '../lib/apiBase';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tierChecked, setTierChecked] = useState(false);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect customers without 'digital_resume' tier
  useEffect(() => {
    let cancelled = false;
    const checkTier = async () => {
      if (!user) { setTierChecked(true); return; }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { if (!cancelled) setRedirect('/auth'); return; }

        let t: string | null = null;
        const res = await fetch(apiUrl('/api/v1/subscription/me'), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const body = await res.json();
          t = body?.data?.tier ?? null;
        }

        // Client fallback when API is unavailable
        if (t !== 'career_identity' && t !== 'digital_resume') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tier')
            .eq('id', session.user.id)
            .maybeSingle();
          if (profile?.tier === 'career_identity' || profile?.tier === 'digital_resume') {
            t = profile.tier;
          } else if (profile || localStorage.getItem('is_crm_user') === 'true') {
            t = 'digital_resume';
          }
        }

    // Guard: do not attempt to update Supabase with a non-UUID id
    if (!isSafeUUID(replacingId)) {
      // Synthetic/API-only record — there is no Supabase row to update.
      // Simply re-upload and refresh the display without touching Supabase.
      try {
        setIsReplacing(true);
        const file = selectedReplaceFile;
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const timestamp = Date.now();
        const fileName = `replaced_resume_${timestamp}.${fileExt}`;
        const filePath = `${crmEmail || user.email}/${fileName}`;
        await supabase.storage.from('CRM_users_resumes').upload(filePath, file, { upsert: true, contentType: file.type || 'application/pdf' });
        showToast("Resume replaced (API-only record — no Supabase row to update).", "success");
        await fetchcareercasts();
        setShowReplaceModal(false);
      } catch (err: any) {
        console.error('❌ Replace failed for synthetic record:', err);
        showToast("Failed to replace resume: " + err.message, "error");
      } finally {
        setIsReplacing(false);
        setReplacingId(null);
        setSelectedReplaceFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }

    try {
      setIsReplacing(true);
      const file = selectedReplaceFile;
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const timestamp = Date.now();
      const fileName = `replaced_resume_${timestamp}.${fileExt}`;

      let publicUrl: string | null = null;

      if (isCRM && crmEmail) {
        // CRM User - Upload to CRM bucket
        const filePath = `${crmEmail}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('CRM_users_resumes')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type || 'application/pdf'
          });
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('CRM_users_resumes')
          .getPublicUrl(filePath);
        publicUrl = publicData?.publicUrl ?? null;

        // Update crm_job_requests (safe: replacingId is a valid UUID here)
        const { error: updateError } = await supabase.from('crm_job_requests')
          .update({
            resume_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', replacingId);

        if (updateError) throw updateError;

        // Also update crm_resumes for consistency
        await supabase.from('crm_resumes').insert({
          email: crmEmail,
          user_id: user.id,
          resume_name: file.name,
          resume_url: publicUrl,
          file_type: fileExt,
          file_size: file.size,
        });

      } else {
        // Regular User - Upload to regular bucket
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type || 'application/pdf'
          });
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('resumes')
          .getPublicUrl(filePath);
        publicUrl = publicData?.publicUrl ?? null;

        // Update job_requests
        const { error: updateError } = await supabase.from('job_requests')
          .update({
            resume_path: publicUrl,
            resume_original_name: file.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', replacingId);

        if (updateError) throw updateError;
      }

      showToast("Resume replaced successfully!", "success");
      fetchcareercasts(); // Refresh the list
      setShowReplaceModal(false);

      // Automatically redirect to download the newly replaced resume
      setTimeout(() => {
        navigate(`/final-result/${replacingId}?autoDownload=true`);
      }, 1500);
    } catch (err: any) {
      console.error("❌ Replace failed:", err);
      showToast("Failed to replace resume: " + err.message, "error");
    } finally {
      setIsReplacing(false);
      setReplacingId(null);
      setSelectedReplaceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 🟢 Handle new careercast click
  const handleNewCast = () => {
    if (credits > 0) {
      // ✅ Has credits → allow recording
      // Clear previous session data to ensure a fresh record is created
      localStorage.removeItem('current_job_request_id');
      localStorage.removeItem('uploadedResumeUrl');
      localStorage.removeItem('resumeFileName');
      localStorage.removeItem('resumeFullText');
      localStorage.removeItem('teleprompterText');
      
      // Skip Step 1 and go directly to Step 1 (Upload Resume) — mark as new so history is hidden
      navigate('/step1?mode=new');
    } else {
      // ⛔ No credits → show upgrade popup
      setShowPricingPopup(true);
    }
  };

  const populateLocalStorage = (cast: any) => {
    // Populate localStorage so steps can resume correctly
    localStorage.setItem('careercast_jobTitle', cast.job_title || '');
    localStorage.setItem('careercast_jobDescription', cast.job_description || '');
    // ⚠️ Only store a real UUID as current_job_request_id.
    // Synthetic/API-only records (is_api_resume: true) have a slug id like
    // "api-resume" which must NEVER be sent to Supabase UUID columns.
    // For those, we store 'profile' as the sentinel instead.
    const safeId = isSafeUUID(cast.id) ? cast.id : 'profile';
    localStorage.setItem('current_job_request_id', safeId);
    localStorage.setItem('uploadedResumeUrl', cast.resume_path || '');
    localStorage.setItem('resumeFileName', cast.resume_path ? cast.resume_path.split('/').pop() : 'Resume.pdf');
    localStorage.setItem('is_crm_user', isCRM ? 'true' : 'false');
    if (isCRM && crmEmail) {
      localStorage.setItem('crm_user_email', crmEmail);
    }
    // --- PARSE SPEED AND TEXT ---
    let actualScript = cast.job_description || '';
    let savedSpeed = '1.0';
    
    if (actualScript.startsWith('[[SPEED:')) {
      const match = actualScript.match(/^\[\[SPEED:([\d.]+)\]\]\s*([\s\S]*)/);
      if (match) {
        savedSpeed = match[1];
        actualScript = match[2];
      }
    }

    localStorage.setItem('teleprompterText', actualScript);
    localStorage.setItem('teleprompterSpeed', savedSpeed);
    
    return { actualScript, savedSpeed };
  };

  const handleReRecord = (cast: any) => {
    const { actualScript } = populateLocalStorage(cast);
    
    // Check if the script is just the placeholder
    const isPlaceholder = actualScript === "Generated from resume analysis";

    // If they already have a video AND a real script, jumping directly to record makes sense (Re-record)
    // If they DON'T have a video, OR the script is missing/placeholder, take them to Step 2
    const hasVideo = cast.recordings && cast.recordings.length > 0;
    
    if (hasVideo && !isPlaceholder) {
      navigate(`/record${isCRM ? '?mode=crm' : ''}`);
    } else {
      navigate('/step2?mode=continue');
    }
  };

  const handleContinue = (cast: any) => {
    populateLocalStorage(cast);
    navigate('/step1?mode=continue');
  };
  const handleViewDetails = (id: string, resumePath?: string) => {
    // For synthetic/API-only records (id is not a real UUID like 'api-resume'),
    // navigate with 'profile' so FinalResult uses the email-based lookup
    // instead of firing an invalid UUID query against Supabase.
    const safeId = isSafeUUID(id) ? id : 'profile';
    navigate(`/final-result/${safeId}`);
  };
  const handleCloseVideo = () => setSelectedVideo(null);
  const handleClosePricingPopup = () => setShowPricingPopup(false);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (redirect) return <Navigate to={redirect} replace />;
  if (!tierChecked) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B4F6C]" /></div>;

  return (
    <div className="min-h-screen bg-white flex">
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 w-auto transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 transition-[width,transform] duration-300 ease-in-out`}
      >
        <Sidebar userEmail={user?.email || ''} onLogout={handleLogout} />
      </div>

      {/* Main Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-700 hover:bg-gray-100"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="font-bold text-xl text-[#0B4F6C]">Digital Resume</div>
          <div className="w-10"></div>
        </div>

        {/* Shared ResumeWorkspace */}
        <ResumeWorkspace user={user} onLogout={handleLogout} />
      </div>
    </div>
  );
}