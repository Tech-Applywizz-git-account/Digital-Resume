import { crmUserRepository } from '../../repositories/crmUser.repository.js';

export class AuthService {
    async resolveLoginEmail(enteredEmail: string): Promise<string> {
        const normalized = enteredEmail.trim().toLowerCase();
        const crmUser = await crmUserRepository.findByEmailOrAppEmail(normalized);
        if (crmUser?.email) {
            return crmUser.email;
        }
        return normalized;
    }
}

export const authService = new AuthService();