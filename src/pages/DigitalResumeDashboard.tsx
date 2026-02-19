import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import {
    Users,
    ShieldCheck,
    User as UserIcon,
    Plus,
    Search,
    Mail,
    CreditCard,
    Building2,
    Calendar,
    Loader2,
    CheckCircle,
    X,
    AlertCircle,
    RefreshCcw,
    ArrowRight,
    Edit,
    Save,
    LogOut,
    LayoutDashboard,
    UserPlus,
    FileUp,
    Download,
    FileText
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface CRMUser {
    email: string;
    credits_remaining: number;
    company_application_email: string | null;
    user_created_at: string;
    is_active: boolean;
    user_id: string | null;
    added_by: string | null;
    resume_url?: string | null;
    resume_name?: string | null;
    latest_job_request_id?: string | null;
    profiles?: {
        full_name: string | null;
    } | null;
}

interface CRMAdmin {
    email: string;
    created_at: string;
}

export default function DigitalResumeDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<CRMUser[]>([]);
    const [admins, setAdmins] = useState<CRMAdmin[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddAdminModal, setShowAddAdminModal] = useState(false);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [isAdminAdding, setIsAdminAdding] = useState(false);
    const [isUserAdding, setIsUserAdding] = useState(false);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Credit editing state
    const [editingCredits, setEditingCredits] = useState<string | null>(null);
    const [newCreditValue, setNewCreditValue] = useState<number>(0);
    const [isUpdatingCredits, setIsUpdatingCredits] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);

    // New: Resume replacing state
    const [replacingResumeEmail, setReplacingResumeEmail] = useState<string | null>(null);
    const [isReplacingResume, setIsReplacingResume] = useState(false);
    const resumeFileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkAccess = async () => {
            console.log('--- Admin Access Check ---');
            const hasSessionAccess = sessionStorage.getItem('digital_resume_admin_access') === 'true';
            const adminEmail = sessionStorage.getItem('admin_email')?.toLowerCase();
            const authEmail = user?.email?.toLowerCase();

            const currentUserEmail = adminEmail || authEmail;

            console.log('Session Flag:', hasSessionAccess);
            console.log('Admin Email:', adminEmail);
            console.log('Auth Email:', authEmail);

            if (!hasSessionAccess && !currentUserEmail) {
                console.log('No credentials found, redirecting to login...');
                navigate('/DigitalResumeLogin');
                return;
            }

            // Primary Admin Bypass
            if (currentUserEmail === 'dinesh@applywizz.com') {
                console.log('Primary Admin detected, bypassing DB check.');
                loadData();
                return;
            }

            // Only check DB if we have an email but it's not the primary admin
            if (currentUserEmail) {
                try {
                    const { data, error } = await supabase
                        .from('crm_admins')
                        .select('email')
                        .eq('email', currentUserEmail)
                        .maybeSingle();

                    if (error) {
                        console.error('Database check error:', error);
                        // If DB errors (table missing), trust the session flag
                        if (hasSessionAccess) {
                            loadData();
                            return;
                        }
                    }

                    if (!data && !hasSessionAccess) {
                        console.log('Not an admin, redirecting...');
                        navigate('/DigitalResumeLogin');
                        return;
                    }
                } catch (err) {
                    console.error('Access check failed:', err);
                    if (!hasSessionAccess) {
                        navigate('/DigitalResumeLogin');
                        return;
                    }
                }
            }

            loadData();
        };

        checkAccess();
    }, [user, navigate]);

    const loadData = async () => {
        setLoading(true);
        await Promise.all([fetchUsers(), fetchAdmins()]);
        setLoading(false);
    };

    const fetchUsers = async () => {
        try {
            setIsRefreshingUsers(true);
            // 1. Fetch CRM users first
            const { data: crmData, error: crmError } = await supabase
                .from('digital_resume_by_crm')
                .select('*')
                .order('user_created_at', { ascending: false });

            if (crmError) throw crmError;
            if (!crmData) return;

            // 2. Identify identifiers
            const userIds = crmData.map(u => u.user_id).filter(id => !!id);
            const userEmails = crmData.map(u => u.email).filter(e => !!e);

            if (userIds.length > 0 || userEmails.length > 0) {
                const BATCH_SIZE = 50;
                const fetchInBatches = async (ids: any[], fetcher: (chunk: any[]) => Promise<any[]>) => {
                    const results = [];
                    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                        const chunk = ids.slice(i, i + BATCH_SIZE);
                        const data = await fetcher(chunk);
                        if (data) results.push(...data);
                    }
                    return results;
                };

                const [profileData, resumeData, jobRequestData] = await Promise.all([
                    fetchInBatches(userIds, async (chunk) => {
                        const { data } = await supabase.from('profiles').select('id, full_name').in('id', chunk);
                        return data || [];
                    }),
                    fetchInBatches(userEmails, async (chunk) => {
                        const { data } = await supabase.from('crm_resumes')
                            .select('email, resume_url, resume_name, created_at')
                            .in('email', chunk)
                            .order('created_at', { ascending: false });
                        return data || [];
                    }),
                    fetchInBatches(userEmails, async (chunk) => {
                        const { data } = await supabase.from('crm_job_requests')
                            .select('id, email, created_at')
                            .in('email', chunk)
                            .order('created_at', { ascending: false });
                        return data || [];
                    })
                ]);

                const profileMap = new Map(profileData?.map(p => [p.id, p.full_name]) || []);
                const resumeMap = new Map();
                const jobRequestMap = new Map();

                const sortedResumes = [...(resumeData || [])].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                sortedResumes.forEach(r => {
                    if (!resumeMap.has(r.email)) {
                        resumeMap.set(r.email, { url: r.resume_url, name: r.resume_name });
                    }
                });

                const sortedJobRequests = [...(jobRequestData || [])].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                sortedJobRequests.forEach(jr => {
                    if (!jobRequestMap.has(jr.email)) {
                        jobRequestMap.set(jr.email, jr.id);
                    }
                });

                const usersWithDetails = crmData.map(user => ({
                    ...user,
                    profiles: profileMap.has(user.user_id)
                        ? { full_name: profileMap.get(user.user_id) }
                        : null,
                    resume_url: resumeMap.get(user.email)?.url || null,
                    resume_name: resumeMap.get(user.email)?.name || null,
                    latest_job_request_id: jobRequestMap.get(user.email) || null
                }));
                setUsers(usersWithDetails);
            } else {
                setUsers(crmData);
            }
        } catch (error: any) {
            console.error('Error fetching CRM users:', error);
            setMessage({ type: 'error', text: 'Error loading user data' });
        } finally {
            setIsRefreshingUsers(false);
        }
    };

    const fetchAdmins = async () => {
        try {
            const { data, error } = await supabase
                .from('crm_admins')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAdmins(data || []);
        } catch (error: any) {
            console.error('Error fetching admins:', error);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsUserAdding(true);
            setMessage(null);

            const normalizedEmail = newUserEmail.trim().toLowerCase();
            const defaultPassword = "Applywizz@123";

            // 1. Create a transient supabase client to sign up the new user
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const authClient = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });

            // 2. Attempt to create the user in Supabase Auth
            const { data: authData, error: authError } = await authClient.auth.signUp({
                email: normalizedEmail,
                password: defaultPassword,
            });

            let targetUserId = authData.user?.id || null;
            let isNewUser = !!authData.user;

            if (authError) {
                // If user already exists, we continue to check/add to digital_resume_by_crm
                if (authError.message.toLowerCase().includes('already registered') || authError.message.toLowerCase().includes('already been registered')) {
                    console.log('User already exists in Auth, checking digital_resume_by_crm...');

                    // Try to get the user ID if they exist
                    const { data: existingUser } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('email', normalizedEmail)
                        .maybeSingle();

                    if (existingUser) targetUserId = existingUser.id;
                } else {
                    throw authError;
                }
            }

            // 3. Add to digital_resume_by_crm table
            const { error: dbError } = await supabase
                .from('digital_resume_by_crm')
                .insert({
                    email: normalizedEmail,
                    user_id: targetUserId,
                    credits_remaining: 4,
                    added_by: user?.email || sessionStorage.getItem('admin_email'),
                    is_active: true
                });

            if (dbError) {
                if (dbError.code === '23505') throw new Error('This user is already in the CRM system.');
                throw dbError;
            }

            // 4. Create initial dashboard stats record (matching the server-side function)
            await supabase.from('crm_dashboard_stats').insert({
                email: normalizedEmail,
                user_id: targetUserId,
                total_applications: 0,
                total_recordings: 0,
                total_resumes: 0,
                total_views: 0
            }).select().maybeSingle();

            // 5. Send credentials email
            let emailSent = false;
            try {
                const emailRes = await fetch('/api/send-credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: normalizedEmail,
                        password: defaultPassword
                    })
                });
                const emailData = await emailRes.json();
                if (emailRes.ok) emailSent = true;
                else console.error('Email API Error:', emailData);
            } catch (emailErr) {
                console.error('Failed to send credentials email:', emailErr);
            }

            if (isNewUser) {
                setMessage({
                    type: 'success',
                    text: `User ${normalizedEmail} added successfully. ${emailSent ? 'Email sent.' : 'Warning: Email failed to send, please check console.'}`
                });
            } else {
                setMessage({
                    type: 'success',
                    text: `Existing user ${normalizedEmail} linked to CRM. Password NOT changed as they already had an account. ${emailSent ? 'Notification email sent.' : 'Warning: Notification email failed.'}`
                });
            }
            setNewUserEmail('');
            setShowAddUserModal(false);
            fetchUsers();
        } catch (error: any) {
            console.error('Error adding user:', error);
            setMessage({ type: 'error', text: error.message || 'Failed to add user' });
        } finally {
            setIsUserAdding(false);
        }
    };

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsAdminAdding(true);
            setMessage(null);

            const normalizedEmail = newAdminEmail.trim().toLowerCase();

            // 1. Create a transient supabase client to sign up the new admin 
            // without affecting the current admin's session.
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const authClient = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });

            // 2. Attempt to create the user in Supabase Auth
            const { error: authError } = await authClient.auth.signUp({
                email: normalizedEmail,
                password: newAdminPassword,
            });

            if (authError) {
                // If user already exists, we continue to check/add to crm_admins
                if (authError.message.toLowerCase().includes('already registered') || authError.message.toLowerCase().includes('already been registered')) {
                    console.log('User already exists in Auth, checking crm_admins...');
                } else {
                    throw authError;
                }
            }

            // 3. Add to crm_admins table to grant dashboard access
            const { error: dbError } = await supabase
                .from('crm_admins')
                .insert({
                    email: normalizedEmail,
                    added_by: user?.email || sessionStorage.getItem('admin_email')
                });

            if (dbError) {
                if (dbError.code === '23505') throw new Error('This email is already an authorized admin.');
                throw dbError;
            }

            setMessage({
                type: 'success',
                text: `${normalizedEmail} is now a CRM Dashboard Admin. Note: If they don't see an email, they may need to check spam or you might need to disable "Email Confirmation" in Supabase Auth settings.`
            });
            setNewAdminEmail('');
            setNewAdminPassword('');
            setShowAddAdminModal(false);
            fetchAdmins();
        } catch (error: any) {
            console.error('Error adding admin:', error);
            setMessage({ type: 'error', text: error.message || 'Failed to add admin' });
        } finally {
            setIsAdminAdding(false);
        }
    };

    const handleUpdateCredits = async (email: string) => {
        try {
            setIsUpdatingCredits(true);
            const { error } = await supabase
                .from('digital_resume_by_crm')
                .update({ credits_remaining: newCreditValue })
                .eq('email', email);

            if (error) throw error;

            // Also update the profile if user_id exists
            const targetUser = users.find(u => u.email === email);
            if (targetUser?.user_id) {
                await supabase
                    .from('profiles')
                    .update({ credits_remaining: newCreditValue })
                    .eq('id', targetUser.user_id);
            }

            setMessage({ type: 'success', text: `Credits updated for ${email}` });
            setEditingCredits(null);
            fetchUsers();
        } catch (error: any) {
            console.error('Error updating credits:', error);
            setMessage({ type: 'error', text: 'Failed to update credits' });
        } finally {
            setIsUpdatingCredits(false);
        }
    };

    const handleReplaceResumeClick = (email: string) => {
        setReplacingResumeEmail(email);
        resumeFileInputRef.current?.click();
    };

    const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !replacingResumeEmail) return;

        try {
            setIsReplacingResume(true);
            const fileExt = file.name.split('.').pop()?.toLowerCase();
            const timestamp = Date.now();
            const fileName = `admin_replaced_${timestamp}.${fileExt}`;
            const filePath = `${replacingResumeEmail}/${fileName}`;

            // 1. Upload to CRM bucket
            const { error: uploadError } = await supabase.storage
                .from('CRM_users_resumes')
                .upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from('CRM_users_resumes')
                .getPublicUrl(filePath);
            const publicUrl = publicData?.publicUrl;

            // 2. Update all CRM job requests for this user (to keep consistency)
            await supabase.from('crm_job_requests')
                .update({ resume_url: publicUrl })
                .eq('email', replacingResumeEmail);

            // 3. Insert/Update crm_resumes record
            await supabase.from('crm_resumes').insert({
                email: replacingResumeEmail,
                resume_name: file.name,
                resume_url: publicUrl,
                file_type: fileExt,
                file_size: file.size,
                user_id: users.find(u => u.email === replacingResumeEmail)?.user_id || null
            });

            setMessage({ type: 'success', text: `Resume replaced successfully for ${replacingResumeEmail}` });
            fetchUsers();
        } catch (err: any) {
            console.error("❌ Admin replace failed:", err);
            setMessage({ type: 'error', text: "Failed to replace resume: " + err.message });
        } finally {
            setIsReplacingResume(false);
            setReplacingResumeEmail(null);
            if (resumeFileInputRef.current) resumeFileInputRef.current.value = '';
        }
    };

    const handleAdminLogout = () => {
        sessionStorage.removeItem('digital_resume_admin_access');
        sessionStorage.removeItem('admin_email');
        navigate('/DigitalResumeLogin');
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.company_application_email?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    );

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

    const currentUserEmail = sessionStorage.getItem('admin_email') || user?.email;

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden antialiased text-slate-900 font-['-apple-system',_BlinkMacSystemFont,_'Segoe_UI',_Roboto,_Helvetica,_Arial,_sans-serif]">
            {/* Top Admin Nav */}
            <nav className="bg-[#0B4F6C] text-white px-6 py-2.5 flex justify-between items-center shadow-lg z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-1.5 rounded-lg backdrop-blur-sm">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div className="hidden sm:block">
                        <h1 className="text-base font-bold tracking-tight uppercase">Digital Resume CRM</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowAddUserModal(true)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Add User</span>
                    </button>

                    <button
                        onClick={() => setShowAddAdminModal(true)}
                        className="bg-[#159A9C] hover:bg-[#159A9C]/90 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
                    >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Add Admin</span>
                    </button>

                    <div className="h-8 w-px bg-white/10 mx-1"></div>

                    <div className="relative">
                        <button
                            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                            className="flex items-center gap-3 hover:bg-white/5 p-1 rounded-xl transition-all"
                        >
                            <div className="w-9 h-9 bg-[#159A9C] rounded-full flex items-center justify-center border-2 border-white/20 shadow-inner">
                                <UserIcon className="w-5 h-5" />
                            </div>
                        </button>

                        {showProfileDropdown && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-4 py-3 border-b border-slate-50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                                    <p className="text-sm font-semibold text-slate-800 truncate">{currentUserEmail}</p>
                                </div>
                                <div className="px-2 py-1">
                                    <button
                                        onClick={handleAdminLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-xl transition-colors font-medium"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Logout Session
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            <main className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
                <div className="max-w-[1600px] mx-auto w-full flex-1 flex flex-col overflow-hidden">
                    {/* Top Search Area */}
                    <div className="mb-8 shrink-0 flex items-center gap-4 w-full">
                        <div className="relative flex-1">
                            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search leads, clients, or domains..."
                                className="w-full pl-12 pr-32 py-4 rounded-xl bg-[#f8fafc] border border-slate-200 focus:ring-4 focus:ring-slate-100 focus:border-slate-300 outline-none transition-all placeholder:text-slate-400 text-[15px] font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                                <Users className="w-4 h-4 text-slate-500" />
                                <span className="text-xs font-bold text-slate-700">
                                    {users.length} <span className="text-[10px] text-slate-400 uppercase tracking-tight ml-0.5">Total Users</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <p className="font-medium text-sm">{message.text}</p>
                            <button onClick={() => setMessage(null)} className="ml-auto hover:bg-black/5 p-1 rounded-lg">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Table container */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
                        <div className="overflow-y-auto flex-1">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full">
                                    <Loader2 className="w-8 h-8 text-[#0B4F6C] animate-spin mb-3" />
                                    <p className="text-slate-500 text-sm font-medium tracking-wide">Syncing CRM Database...</p>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="text-center py-20">
                                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Search className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900">No records found</h3>
                                    <p className="text-slate-500 text-xs">Clear filters to see all users</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse table-fixed">
                                    <thead className="sticky top-0 bg-slate-50 z-10">
                                        <tr className="border-b border-slate-200 bg-[#fbfcfd]">
                                            <th className="px-6 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider w-[30%]">Company Application Email</th>
                                            <th className="px-6 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider w-[22%]">Personal Email</th>
                                            <th className="px-6 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider w-[12%] text-center">Resume</th>
                                            <th className="px-6 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider w-[12%] text-center">Credits</th>
                                            <th className="px-6 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider w-[12%]">Joined</th>
                                            <th className="px-6 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider w-[7%] text-center">Status</th>
                                            <th className="px-6 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider w-[5%] text-right">Audit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredUsers.map((user_row) => (
                                            <tr key={user_row.email} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-6 py-5 text-[14px] font-medium text-slate-800">
                                                    <div className="flex flex-col">
                                                        {user_row.profiles?.full_name && (
                                                            <span className="font-bold text-slate-900">{user_row.profiles.full_name}</span>
                                                        )}
                                                        {user_row.company_application_email ? (
                                                            <span className={user_row.profiles?.full_name ? "text-xs text-slate-500" : ""}>
                                                                {user_row.company_application_email}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 font-normal">Dashboard Record</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="font-medium text-slate-600 text-[13px] truncate">{user_row.email}</p>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        {user_row.resume_url ? (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        if (user_row.latest_job_request_id) {
                                                                            navigate(`/final-result/${user_row.latest_job_request_id}`);
                                                                        } else if (user_row.resume_url) {
                                                                            window.open(user_row.resume_url, '_blank');
                                                                        }
                                                                    }}
                                                                    className="flex items-center gap-1.5 px-4 py-2 bg-[#0B4F6C] text-white rounded-lg hover:bg-[#0B4F6C]/90 transition-all text-[11px] font-bold uppercase tracking-wider shadow-sm active:scale-95"
                                                                >
                                                                    <FileText className="w-3.5 h-3.5" />
                                                                    View
                                                                </button>
                                                                <button
                                                                    onClick={() => handleReplaceResumeClick(user_row.email)}
                                                                    disabled={isReplacingResume && replacingResumeEmail === user_row.email}
                                                                    className="flex items-center gap-1.5 px-4 py-2 bg-[#159A9C] text-white rounded-lg hover:bg-[#159A9C]/90 transition-all text-[11px] font-bold uppercase tracking-wider shadow-sm active:scale-95 disabled:opacity-50"
                                                                >
                                                                    {isReplacingResume && replacingResumeEmail === user_row.email ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <FileUp className="w-3.5 h-3.5" />
                                                                    )}
                                                                    Replace
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleReplaceResumeClick(user_row.email)}
                                                                disabled={isReplacingResume && replacingResumeEmail === user_row.email}
                                                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all text-[11px] font-bold uppercase tracking-wider shadow-sm active:scale-95 disabled:opacity-50"
                                                            >
                                                                {isReplacingResume && replacingResumeEmail === user_row.email ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                )}
                                                                Add Resume
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {editingCredits === user_row.email ? (
                                                        <div className="flex items-center gap-2 focus-within:z-20 justify-center">
                                                            <input
                                                                type="number"
                                                                className="w-16 px-2 py-1.5 text-base font-bold border-2 rounded-lg focus:ring-2 focus:ring-[#0B4F6C]/20 border-slate-300"
                                                                value={newCreditValue}
                                                                onChange={(e) => setNewCreditValue(parseInt(e.target.value))}
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={() => handleUpdateCredits(user_row.email)}
                                                                disabled={isUpdatingCredits}
                                                                className="bg-[#0B4F6C] text-white p-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                                                            >
                                                                {isUpdatingCredits ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingCredits(null)}
                                                                className="bg-slate-200 text-slate-600 p-2 rounded-lg hover:bg-slate-300"
                                                            >
                                                                <X className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3 group/credit justify-center">
                                                            <div className={`px-4 py-1.5 bg-white rounded-xl text-[16px] font-black border-2 ${user_row.credits_remaining > 0
                                                                ? 'text-emerald-700 border-emerald-200 bg-emerald-50/30'
                                                                : 'text-rose-700 border-rose-200 bg-rose-50/30'
                                                                }`}>
                                                                {user_row.credits_remaining}
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingCredits(user_row.email);
                                                                    setNewCreditValue(user_row.credits_remaining);
                                                                }}
                                                                className="opacity-0 group-hover/credit:opacity-100 p-2 text-slate-500 hover:text-[#0B4F6C] hover:bg-[#0B4F6C]/5 rounded-xl transition-all"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5 text-slate-700 text-[14px] font-bold">
                                                    {formatDate(user_row.user_created_at)}
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border-2 ${user_row.is_active
                                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                        : 'bg-slate-200 text-slate-700 border-slate-300'
                                                        }`}>
                                                        <div className={`w-2.5 h-2.5 rounded-full ${user_row.is_active ? 'bg-emerald-600' : 'bg-slate-500'}`} />
                                                        {user_row.is_active ? 'Active' : 'Locked'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={async () => {
                                                            await fetchUsers();
                                                            setMessage({ type: 'success', text: 'User list refreshed successfully' });
                                                        }}
                                                        disabled={isRefreshingUsers}
                                                        className="p-2 text-slate-400 hover:text-[#0B4F6C] hover:bg-[#0B4F6C]/5 rounded-xl transition-all disabled:opacity-50"
                                                        title="Sync with database"
                                                    >
                                                        <RefreshCcw className={`w-4 h-4 ${isRefreshingUsers ? 'animate-spin text-[#0B4F6C]' : ''}`} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Add User Modal */}
            {
                showAddUserModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-600 text-white">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <UserPlus className="w-6 h-6" />
                                        Add New CRM User
                                    </h3>
                                    <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mt-1">User Enrollment Portal</p>
                                </div>
                                <button
                                    onClick={() => !isUserAdding && setShowAddUserModal(false)}
                                    className="hover:bg-white/10 p-2 rounded-xl transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleAddUser} className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">User Email Address</label>
                                        <div className="relative group">
                                            <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-emerald-500 transition-colors" />
                                            <input
                                                type="email"
                                                required
                                                placeholder="user@example.com"
                                                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300 font-medium"
                                                value={newUserEmail}
                                                onChange={(e) => setNewUserEmail(e.target.value.toLowerCase())}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                        <p className="text-[11px] text-emerald-800 font-medium">
                                            <span className="font-bold">Default Credentials:</span><br />
                                            Password: <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-bold ml-1">Applywizz@123</code>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        disabled={isUserAdding}
                                        onClick={() => setShowAddUserModal(false)}
                                        className="flex-1 px-4 py-4 rounded-2xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-all text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isUserAdding}
                                        className="flex-1 bg-emerald-600 text-white px-4 py-4 rounded-2xl font-bold shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-sm"
                                    >
                                        {isUserAdding ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                Add User
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Add Admin Modal */}
            {
                showAddAdminModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-[#0f172a] text-white">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <ShieldCheck className="w-6 h-6" />
                                        Grant Admin Access
                                    </h3>
                                    <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mt-1">Permission Control Portal</p>
                                </div>
                                <button
                                    onClick={() => !isAdminAdding && setShowAddAdminModal(false)}
                                    className="hover:bg-white/10 p-2 rounded-xl transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleAddAdmin} className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Email Address</label>
                                        <div className="relative group">
                                            <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-[#0B4F6C] transition-colors" />
                                            <input
                                                type="email"
                                                required
                                                placeholder="name@applywizz.com"
                                                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-[#0B4F6C]/5 focus:border-[#0B4F6C] outline-none transition-all placeholder:text-slate-300 font-medium"
                                                value={newAdminEmail}
                                                onChange={(e) => setNewAdminEmail(e.target.value.toLowerCase())}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Secure Password</label>
                                        <div className="relative group">
                                            <ShieldCheck className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-[#0B4F6C] transition-colors" />
                                            <input
                                                type="password"
                                                required
                                                placeholder="Set a password"
                                                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-[#0B4F6C]/5 focus:border-[#0B4F6C] outline-none transition-all placeholder:text-slate-300 font-medium"
                                                value={newAdminPassword}
                                                onChange={(e) => setNewAdminPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100/50">
                                    <div className="flex gap-4">
                                        <div className="bg-blue-100 p-2 rounded-xl flex-shrink-0 w-10 h-10 flex items-center justify-center">
                                            <AlertCircle className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-blue-900 mb-1 uppercase tracking-wide">Privilege Information</h4>
                                            <p className="text-[11px] text-blue-800 leading-relaxed">
                                                New admins will have full read/write access to this dashboard, including credit management and admin enrollment privileges.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        disabled={isAdminAdding}
                                        onClick={() => setShowAddAdminModal(false)}
                                        className="flex-1 px-4 py-4 rounded-2xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-all text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isAdminAdding}
                                        className="flex-1 bg-[#0f172a] text-white px-4 py-4 rounded-2xl font-bold shadow-xl shadow-slate-200 hover:bg-[#1e293b] transition-all flex items-center justify-center gap-2 text-sm"
                                    >
                                        {isAdminAdding ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                Grant Access
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Hidden File Input for Resume Replace */}
            <input
                type="file"
                ref={resumeFileInputRef}
                onChange={handleResumeFileChange}
                accept=".pdf,.doc,.docx"
                className="hidden"
            />
        </div>
    );
}
