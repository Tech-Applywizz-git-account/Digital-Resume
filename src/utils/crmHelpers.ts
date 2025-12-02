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
 * Get user type and email
 */
export const getUserInfo = async (userId: string) => {
    const isCRM = await isCRMUser(userId);
    const email = isCRM ? await getCRMUserEmail(userId) : null;

    return {
        isCRMUser: isCRM,
        email: email,
    };
};
