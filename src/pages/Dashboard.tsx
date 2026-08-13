import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
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

        if (t === 'career_identity') { if (!cancelled) setRedirect('/career-identity-dashboard'); return; }
        if (t !== 'digital_resume') { if (!cancelled) setRedirect('/'); return; }
        if (!cancelled) setTierChecked(true);
      } catch { if (!cancelled) setRedirect('/'); }
    };
    checkTier();
    return () => { cancelled = true; };
  }, [user]);

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