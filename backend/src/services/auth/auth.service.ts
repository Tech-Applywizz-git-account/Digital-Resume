import { userRepository } from '../../repositories/user.repository.js';
import { crmUserRepository } from '../../repositories/crmUser.repository.js';

export class AuthService {
    async resolveLoginEmail(enteredEmail: string): Promise<string> {
        const normalized = enteredEmail.trim().toLowerCase();

        // 1. Check in public.users table (checks email and company_email)
        const user = await userRepository.findByEmailOrCompanyEmail(normalized);
        if (user?.email) {
            return user.email;
        }

        // 2. Fallback to legacy CRM table
        const crmUser = await crmUserRepository.findByEmailOrAppEmail(normalized);
        if (crmUser?.email) {
            return crmUser.email;
        }

        // 3. Fallback to entered email
        return normalized;
    }
}

export const authService = new AuthService();