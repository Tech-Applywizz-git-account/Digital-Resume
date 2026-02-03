import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import {
    Eye,
    EyeOff,
    ArrowLeft,
    ArrowRight,
    Loader2,
    AlertCircle
} from 'lucide-react';

export default function DigitalResumeLogin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const normalizedEmail = email.trim().toLowerCase();

            // 1. Check if the user is listed in crm_admins table
            try {
                const { data: adminData, error: adminCheckError } = await supabase
                    .from('crm_admins')
                    .select('email')
                    .eq('email', normalizedEmail)
                    .maybeSingle();

                if ((adminCheckError || !adminData) && normalizedEmail !== 'dinesh@applywizz.com') {
                    throw new Error('Unauthorized access. Your email is not registered as a CRM Dashboard admin.');
                }
            } catch (err: any) {
                // If table doesn't exist, only allow dinesh@applywizz.com
                if (normalizedEmail !== 'dinesh@applywizz.com') {
                    throw new Error(err.message || 'Verification failed. Please ensure the admin table is set up.');
                }
                console.warn('Dashboard admin table check failed, but allowing primary admin fallback.');
            }

            // 2. Perform regular Auth login
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password: password,
            });

            if (authError) {
                if (authError.message.includes('Invalid login credentials')) {
                    throw new Error('Invalid email or password.');
                }
                if (authError.message.includes('Email not confirmed')) {
                    throw new Error('Your email is not confirmed. Please check your inbox for a verification link.');
                }
                throw authError;
            }

            // 3. Set session flag and navigate
            sessionStorage.setItem('digital_resume_admin_access', 'true');
            sessionStorage.setItem('admin_email', normalizedEmail);
            navigate('/digital-resume-dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f3f7fb] flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-[480px] bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100 p-10 md:p-14">
                {/* Header Section */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">Digital Resume</h1>
                    <p className="text-[10px] font-bold text-[#0B4F6C] uppercase tracking-[0.2em] mt-1">Email Intelligence</p>
                    <p className="text-slate-500 text-sm mt-6 font-medium">Join thousands of professionals getting their dream jobs</p>
                </div>

                {/* Tab-like Login Indicator */}
                <div className="mb-10">
                    <div className="bg-[#0f172a] text-white py-3 rounded-xl text-center font-bold text-sm shadow-lg shadow-slate-200">
                        Login
                    </div>
                </div>

                {/* Form Group */}
                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm flex gap-3 items-center animate-in fade-in duration-300">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="font-medium text-[13px]">{error}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-[#334155] ml-1">Admin Email Address</label>
                        <input
                            type="email"
                            required
                            placeholder="Enter your admin email"
                            className="w-full bg-white border border-slate-200 text-slate-900 px-4 py-4 rounded-xl focus:border-[#0B4F6C] focus:ring-4 focus:ring-[#0B4F6C]/5 outline-none transition-all placeholder:text-slate-400 font-medium"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-[#334155] ml-1">Secure Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                placeholder="Enter your password"
                                className="w-full bg-white border border-slate-200 text-slate-900 px-4 py-4 pr-12 rounded-xl focus:border-[#0B4F6C] focus:ring-4 focus:ring-[#0B4F6C]/5 outline-none transition-all placeholder:text-slate-400 font-medium"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#0f172a] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#1e293b] active:scale-[0.98] transition-all mt-4"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Sign In to Dashboard
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-10 text-center">
                    <button
                        onClick={() => navigate('/')}
                        className="text-slate-500 hover:text-slate-800 text-sm font-bold flex items-center justify-center gap-2 mx-auto transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
