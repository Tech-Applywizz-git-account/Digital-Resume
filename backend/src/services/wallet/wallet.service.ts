/**
 * Wallet Service (Provider Orchestrator + Native Pass)
 * ------------------------------------------------------------------
 * Registry of wallet providers. New providers register here.
 * Controller routes call getProvider(type) to dispatch work.
 *
 * Existing native Apple Wallet (.pkpass) generation is preserved
 * in this file. The provider pattern for NeatPass/Tap2 is additive.
 */
import { PKPass } from 'passkit-generator';
import { getDatabase } from '../../config/database.js';
import { profileRepository } from '../../repositories/profile.repository.js';
import { crmJobRequestRepository } from '../../repositories/crmJobRequest.repository.js';
import { jobRequestRepository } from '../../repositories/jobRequest.repository.js';
import { subscriptionService } from '../subscription/subscription.service.js';
import { NotFoundError } from '../../types/errors.js';
import { neatpassProvider } from './providers/neatpass/neatpass.service.js';
import { tap2Provider } from './providers/tap2/tap2.service.js';
import type { WalletProvider, WalletProviderType } from './wallet.types.js';

// Re-export types
export type { WalletProvider, WalletProviderType } from './wallet.types.js';

// ── Provider Registry ─────────────────────────────────────────

class WalletProviderRegistry {
    private providers: Map<WalletProviderType, WalletProvider> = new Map();

    constructor() {
        this.register(neatpassProvider);
        this.register(tap2Provider);
    }

    register(provider: WalletProvider): void {
        this.providers.set(provider.type, provider);
    }

    getProvider(type: WalletProviderType): WalletProvider {
        const provider = this.providers.get(type);
        if (!provider) {
            throw new Error(`Wallet provider '${type}' is not registered.`);
        }
        if (!provider.isAvailable()) {
            throw new Error(provider.getUnavailableMessage());
        }
        return provider;
    }

    listProviders(): Array<{ type: WalletProviderType; label: string; available: boolean }> {
        return Array.from(this.providers.values()).map((p) => ({
            type: p.type,
            label: p.label,
            available: p.isAvailable(),
        }));
    }
}

export const walletProviderRegistry = new WalletProviderRegistry();

// ── Native Apple Wallet (.pkpass) Service ─────────────────────
// Preserved from the original implementation.

export interface AppleWalletCredentials {
    passTypeIdentifier: string;
    teamIdentifier: string;
    signerCert: Buffer;
    signerKey: Buffer;
    signerKeyPassphrase?: string;
    wwdr: Buffer;
}

export interface CareerIdentityPassData {
    castId: string;
    fullName: string | null;
    jobTitle: string | null;
    headline: string | null;
    location: string | null;
    yearsOfExperience: number | null;
    verified: boolean;
    openToWork: boolean;
    openToRelocate: boolean;
    remote: boolean;
    immediateJoiner: boolean;
}

class WalletService {
    /**
     * Loads Apple PassKit signing credentials from environment.
     */
    private loadCredentials(): AppleWalletCredentials | null {
        const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER;
        const teamIdentifier = process.env.APPLE_TEAM_IDENTIFIER;
        const signerCertB64 = process.env.APPLE_PASS_SIGNER_CERT_BASE64;
        const signerKeyB64 = process.env.APPLE_PASS_SIGNER_KEY_BASE64;
        const wwdrB64 = process.env.APPLE_WWDR_CERT_BASE64;

        if (!passTypeIdentifier || !teamIdentifier || !signerCertB64 || !signerKeyB64 || !wwdrB64) {
            return null;
        }

        return {
            passTypeIdentifier,
            teamIdentifier,
            signerCert: Buffer.from(signerCertB64, 'base64'),
            signerKey: Buffer.from(signerKeyB64, 'base64'),
            signerKeyPassphrase: process.env.APPLE_PASS_SIGNER_KEY_PASSPHRASE || undefined,
            wwdr: Buffer.from(wwdrB64, 'base64'),
        };
    }

    /**
     * Resolves the castId record WITHOUT loading Career Identity profile content.
     */
    private async resolveWalletRecord(castId: string): Promise<{ record: any; isCRM: boolean }> {
        const [crmResult, regularResult] = await Promise.all([
            crmJobRequestRepository.findOne({ id: castId } as any),
            jobRequestRepository.findOne({ id: castId } as any),
        ]);

        const record = crmResult || regularResult;
        if (!record) {
            throw new NotFoundError('Career Identity profile', castId);
        }
        return { record, isCRM: !!crmResult };
    }

    /**
     * Verifies that the authenticated user owns the resolved record.
     */
    private verifyOwnership(record: any, authenticatedUserId: string): void {
        const ownerId: string | null = record.user_id || null;
        if (!ownerId) {
            throw new Error('Forbidden: you do not own this Career Identity profile');
        }
        if (ownerId !== authenticatedUserId) {
            throw new Error('Forbidden: you do not own this Career Identity profile');
        }
    }

    /**
     * Fetches Career Identity profile content and maps it to pass data.
     */
    private async getCareerIdentityPassData(castId: string, record: any): Promise<CareerIdentityPassData> {
        const userId: string | null = record.user_id || null;
        let ciData: any = {};
        if (userId) {
            const profile = await profileRepository.findById(userId);
            if (profile) {
                ciData = (profile as any).career_identity_data ?? {};
            }
        }

        const content: Record<string, any> = ciData.content ?? {};
        const hero: Record<string, any> = content.hero ?? {};

        let fullName: string | null = hero.fullName || null;
        let location: string | null = content.contact?.location || null;

        if (!fullName && userId) {
            const profile = await profileRepository.findById(userId);
            fullName = profile?.full_name || profile?.first_name || null;
        }

        const yearsOfExperience = this.estimateYears(content.experience || []);

        return {
            castId,
            fullName,
            jobTitle: record.job_title || null,
            headline: hero.headline || null,
            location,
            yearsOfExperience,
            verified: hero.verified ?? false,
            openToWork: hero.openToWork ?? false,
            openToRelocate: hero.openToRelocate ?? false,
            remote: hero.remote ?? false,
            immediateJoiner: hero.immediateJoiner ?? false,
        };
    }

    private estimateYears(items: { startDate?: string }[]): number | null {
        const years = items
            .map((item) => {
                const match = item.startDate?.match(/\d{4}/);
                return match ? parseInt(match[0], 10) : null;
            })
            .filter((y): y is number => y !== null);
        if (years.length === 0) return null;
        const diff = new Date().getFullYear() - Math.min(...years);
        return diff > 0 ? diff : null;
    }

    /**
     * Generates a signed .pkpass for a Career Identity profile.
     * Preserved from original implementation.
     */
    async generatePass(castId: string, authenticatedUserId: string, _authenticatedEmail: string): Promise<Buffer> {
        const credentials = this.loadCredentials();
        if (!credentials) {
            throw new Error('Apple Wallet pass generation is not configured. Missing PassKit credentials.');
        }

        const { record } = await this.resolveWalletRecord(castId);
        this.verifyOwnership(record, authenticatedUserId);

        const tier = await subscriptionService.getTier(castId);
        if (tier !== 'career_identity') {
            throw new Error('Apple Wallet is only available for Career Identity profiles.');
        }

        const data = await this.getCareerIdentityPassData(castId, record);

        const pass = new PKPass(
            {
                passTypeIdentifier: credentials.passTypeIdentifier,
                teamIdentifier: credentials.teamIdentifier,
                organizationName: 'Applywizz',
                description: `Career Identity - ${data.fullName || 'Professional Profile'}`,
                serialNumber: `ci-${castId}-${Date.now()}`,
                foregroundColor: 'rgb(11, 79, 108)',
                backgroundColor: 'rgb(255, 255, 255)',
                labelColor: 'rgb(100, 116, 139)',
            } as any,
            {
                signerCert: credentials.signerCert,
                signerKey: credentials.signerKey,
                signerKeyPassphrase: credentials.signerKeyPassphrase || undefined,
                wwdr: credentials.wwdr,
            } as any,
        );

        if (data.fullName) {
            pass.primaryFields.push({ key: 'name', label: 'NAME', value: data.fullName });
        }
        if (data.jobTitle) {
            pass.primaryFields.push({ key: 'role', label: 'ROLE', value: data.jobTitle });
        }
        if (data.headline) {
            pass.secondaryFields.push({ key: 'headline', label: 'HEADLINE', value: data.headline });
        }
        if (data.location) {
            pass.secondaryFields.push({ key: 'location', label: 'LOCATION', value: data.location });
        }
        if (data.yearsOfExperience) {
            pass.secondaryFields.push({
                key: 'experience',
                label: 'EXPERIENCE',
                value: `${data.yearsOfExperience}+ years`,
            });
        }

        const signals: string[] = [];
        if (data.verified) signals.push('Verified');
        if (data.openToWork) signals.push('Open to Work');
        if (data.openToRelocate) signals.push('Open to Relocate');
        if (data.remote) signals.push('Remote');
        if (data.immediateJoiner) signals.push('Immediate Joiner');

        if (signals.length > 0) {
            pass.auxiliaryFields.push({
                key: 'signals',
                label: 'PROFESSIONAL SIGNALS',
                value: signals.join('  ·  '),
            });
        }

        const publicUrl = process.env.CAREER_IDENTITY_PUBLIC_URL ||
            `https://applywizz.com/career-identity/${castId}`;

        (pass as any).setBarcodes([{
            format: 'PKBarcodeFormatQR',
            message: publicUrl,
            messageEncoding: 'iso-8859-1',
            altText: publicUrl,
        } as any]);

        (pass as any).setRelevantDate(new Date().toISOString());

        const passBuffer = await pass.getAsBuffer();
        return passBuffer;
    }
}

export const walletService = new WalletService();