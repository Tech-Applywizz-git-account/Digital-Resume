import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { emailService } from '../services/emailService';
import { supabase } from '../integrations/supabase/client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: SignupData) => Promise<void>;
  logout: () => void;
  sendOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<boolean>;
  isOTPVerified: (email: string) => boolean;
  loading: boolean;
  error: string | null;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// ✅ Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track verified OTPs locally (email -> true)
  const [verifiedEmails, setVerifiedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('userData');
      if (token && userData) {
        setIsAuthenticated(true);
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);

        // 🔹 DOUBLE CHECK CRM STATUS ON LOAD (Fix for persisted sessions)
        try {
          const { data: crmData } = await supabase
            .from('digital_resume_by_crm')
            .select('email')
            .eq('user_id', parsedUser.id)
            .single();

          if (crmData) {
            console.log("✅ CRM User detected on load:", crmData.email);
            localStorage.setItem('is_crm_user', 'true');
            localStorage.setItem('crm_user_email', crmData.email);
          } else {
            localStorage.removeItem('is_crm_user');
            localStorage.removeItem('crm_user_email');
          }
        } catch (err) {
          console.error("Error checking CRM status on load:", err);
        }
      }
    };
    initAuth();
  }, []);

  const clearError = () => setError(null);

  // ✅ LOGIN
  const login = async (email: string, password: string): Promise<void> => {
    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    clearError();
    clearSessionCache(); // Clear everything BEFORE logging in as a new user
    try {
      console.log('Attempting login for:', normalizedEmail);
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) throw error;

      const uid = data.user?.id;
      if (!uid) throw new Error('User ID missing after login');

      // Check if CRM user (we do this again to ensure we get the right crmData)
      const { data: crmData } = await supabase
        .from('digital_resume_by_crm')
        .select('email')
        .eq('user_id', uid)
        .single();

      if (crmData) {
        localStorage.setItem('is_crm_user', 'true');
        localStorage.setItem('crm_user_email', crmData.email);
      } else {
        localStorage.removeItem('is_crm_user');
        localStorage.removeItem('crm_user_email');
      }

      let profileData = null;
      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
        profileData = profile;
      } catch (profileErr) {
        console.warn("Could not fetch user profile:", profileErr);
      }

      const mockUser = {
        id: uid,
        email,
        firstName: profileData?.first_name || email.split('@')[0],
        lastName: profileData?.last_name || '',
        name: profileData?.full_name || email.split('@')[0],
      };

      localStorage.setItem('authToken', 'supabase-session');
      localStorage.setItem('userData', JSON.stringify(mockUser));
      setIsAuthenticated(true);
      setUser(mockUser);
    } catch (err: any) {
      const normalizedEmail = email.trim().toLowerCase();
      if (err.message && err.message.toLowerCase().includes('invalid login credentials')) {
        // Double check if the user exists in profiles, crm_admins, or digital_resume_by_crm
        const [{ data: profileUser }, { data: adminUser }, { data: crmUser }] = await Promise.all([
          supabase.from('profiles').select('email').eq('email', normalizedEmail).maybeSingle(),
          supabase.from('crm_admins').select('email').eq('email', normalizedEmail).maybeSingle(),
          supabase.from('digital_resume_by_crm').select('email').eq('email', normalizedEmail).maybeSingle()
        ]);

        if (profileUser || adminUser || crmUser) {
          setError('Invalid login credentials. Please check your password.');
        } else {
          setError('You did not purchase the Digital Resume. To log in, please purchase the Digital Resume.');
        }
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ✅ SIGNUP
  const signup = async (userData: SignupData): Promise<void> => {
    setLoading(true);
    clearError();
    clearSessionCache(); // Clear everything BEFORE signing up as a new user

    try {
      // Require verified OTP before signup
      if (!verifiedEmails.has(userData.email)) {
        throw new Error('Please verify your email with OTP first');
      }

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      });
      if (signUpErr) throw signUpErr;

      let uid = signUpData.user?.id;

      if (!uid) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: userData.password,
        });
        if (signInErr) throw signInErr;
        uid = signInData.user?.id;
      }

      if (!uid) throw new Error('User ID missing after signup');

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: uid,
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        full_name: `${userData.firstName} ${userData.lastName}`,
      });
      if (profileErr) throw profileErr;

      const mockUser = {
        id: uid,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        name: `${userData.firstName} ${userData.lastName}`,
      };

      localStorage.setItem('authToken', 'supabase-session');
      localStorage.setItem('userData', JSON.stringify(mockUser));
      setIsAuthenticated(true);
      setUser(mockUser);
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ✅ SEND OTP using backend API
  const sendOTP = async (email: string): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      console.log('✅ OTP sent successfully:', data.message);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ✅ VERIFY OTP using backend API
  const verifyOTP = async (email: string, otp: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', email, otp }),
      });

      const data = await res.json();
      if (data.success) {
        setVerifiedEmails((prev) => new Set(prev).add(email));
        return true;
      } else {
        setError(data.message || 'Invalid OTP');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
      return false;
    }
  };

  const isOTPVerified = (email: string): boolean => verifiedEmails.has(email);
  
  const clearSessionCache = () => {
    // 1. Identify current user info for specific cache clearing
    const userDataStr = localStorage.getItem('userData');
    let emailKey = '';
    if (userDataStr) {
      try {
        const pd = JSON.parse(userDataStr);
        if (pd.email) emailKey = pd.email.replace(/[^a-zA-Z0-9]/g, '_');
      } catch (e) {}
    }

    // 2. Define global keys to clear
    const globalKeys = [
      'authToken', 
      'userData', 
      'is_crm_user', 
      'crm_user_email',
      'last_careercasts', 
      'last_premium_active', 
      'last_credits',
      'current_job_request_id', 
      'uploadedResumeUrl', 
      'resumeFileName', 
      'resumeFullText',
      'teleprompterText', 
      'teleprompterSpeed',
      'careercast_jobTitle', 
      'careercast_jobDescription',
      'recordedVideoUrl',
      'userCountry'
    ];
    
    globalKeys.forEach(key => localStorage.removeItem(key));

    // 3. Define user-specific keys to clear if we found an email
    if (emailKey) {
      const userKeys = [
        `last_careercasts_${emailKey}`,
        `last_premium_active_${emailKey}`,
        `last_credits_${emailKey}`
      ];
      userKeys.forEach(key => localStorage.removeItem(key));
    }
  };

  const logout = () => {
    clearSessionCache();
    setIsAuthenticated(false);
    setUser(null);
  };

  const contextValue: AuthContextType = {
    isAuthenticated,
    user,
    login,
    signup,
    logout,
    sendOTP,
    verifyOTP,
    isOTPVerified,
    loading,
    error,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export const useAuthContext = useAuth;
