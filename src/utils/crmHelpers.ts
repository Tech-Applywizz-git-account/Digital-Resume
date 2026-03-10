import { supabase } from '../integrations/supabase/client';

/**
 * Check if the current user is a CRM user
 */
export const isCRMUser = async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('digital_resume_by_crm')
        .select('email')
        .eq('user_id', userId)
        .single();

    return !!data && !error;
};

/**
 * Get CRM user email
 */
export const getCRMUserEmail = async (userId: string): Promise<string | null> => {
    const { data } = await supabase
        .from('digital_resume_by_crm')
        .select('email')
        .eq('user_id', userId)
        .single();

    return data?.email || null;
};

/**
 * Get user type and emails
 */
export const getUserInfo = async (userId: string) => {
    const { data } = await supabase
        .from('digital_resume_by_crm')
        .select('email, company_application_email')
        .eq('user_id', userId)
        .maybeSingle();

    const isCRM = !!data;

    return {
        isCRMUser: isCRM,
        email: data?.email || null,
        company_application_email: data?.company_application_email || null,
    };
};
