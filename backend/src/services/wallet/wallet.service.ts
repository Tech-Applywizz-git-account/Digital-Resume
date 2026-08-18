/**
 * Wallet Service (Provider Orchestrator + Native Apple Pass)
 */
import { PKPass } from 'passkit-generator';
import { subscriptionService } from '../subscription/subscription.service.js';
import { neatpassProvider } from './providers/neatpass/neatpass.service.js';
import { tap2Provider } from './providers/tap2/tap2.service.js';
import { googleWalletService } from './providers/google/googleWallet.service.js';
import {
    assertWalletAccess,
    loadWalletCardData,
    publicCareerIdentityUrl,
} from './walletProfile.js';
import type { WalletCardData, WalletProvider, WalletProviderType } from './wallet.types.js';

export type { WalletProvider, WalletProviderType } from './wallet.types.js';

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

export interface AppleWalletCredentials {
    passTypeIdentifier: string;
    teamIdentifier: string;
    signerCert: Buffer;
    signerKey: Buffer;
    signerKeyPassphrase?: string;
    wwdr: Buffer;
}

class WalletService {
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

    isAppleConfigured(): boolean {
        return !!this.loadCredentials();
    }

    async generateVisualCard(castId: string, authenticatedUserId?: string): Promise<{ buffer: Buffer; data: WalletCardData }> {
        const { record, userId } = await assertWalletAccess(castId, authenticatedUserId);
        const data = await loadWalletCardData(castId, record, userId);
        const buffer = await neatpassProvider.generateCard(data);
        return { buffer, data };
    }

    async generateGoogleSaveUrl(castId: string, authenticatedUserId?: string): Promise<string> {
        if (!googleWalletService.isAvailable()) {
            throw new Error(googleWalletService.getUnavailableMessage());
        }
        const { record, userId } = await assertWalletAccess(castId, authenticatedUserId);
        const data = await loadWalletCardData(castId, record, userId);
        return googleWalletService.createSaveUrl(data);
    }

    async generatePass(castId: string, authenticatedUserId?: string): Promise<Buffer> {
        const credentials = this.loadCredentials();
        if (!credentials) {
            throw new Error('Apple Wallet pass generation is not configured. Missing PassKit credentials.');
        }

        const { record, userId } = await assertWalletAccess(castId, authenticatedUserId);
        const tier = await subscriptionService.getTier(castId);
        if (tier !== 'career_identity') {
            throw new Error('Apple Wallet is only available for Career Identity profiles.');
        }

        const data = await loadWalletCardData(castId, record, userId);
        const { iconPng } = await neatpassProvider.renderAssets(data);
        const publicUrl = data.careerIdentityUrl || publicCareerIdentityUrl(castId);

        const passJson = {
            formatVersion: 1,
            passTypeIdentifier: credentials.passTypeIdentifier,
            teamIdentifier: credentials.teamIdentifier,
            organizationName: 'ApplyWizz',
            description: `Career Identity — ${data.fullName || 'Professional'}`,
            serialNumber: `ci-${castId}`.slice(0, 64),
            logoText: 'CAREER IDENTITY',
            foregroundColor: 'rgb(246, 231, 193)',
            backgroundColor: 'rgb(10, 14, 20)',
            labelColor: 'rgb(200, 164, 90)',
            generic: {
                primaryFields: [
                    { key: 'name', label: 'NAME', value: data.fullName || 'Professional' },
                ],
                secondaryFields: [
                    data.jobTitle ? { key: 'role', label: 'ROLE', value: data.jobTitle } : null,
                    data.location ? { key: 'location', label: 'BASED IN', value: data.location } : null,
                ].filter(Boolean),
                auxiliaryFields: [
                    data.email ? { key: 'email', label: 'EMAIL', value: data.email } : null,
                    data.phone ? { key: 'phone', label: 'PHONE', value: data.phone } : null,
                ].filter(Boolean),
                backFields: [
                    { key: 'profile', label: 'CAREER IDENTITY', value: publicUrl },
                    data.headline ? { key: 'headline', label: 'HEADLINE', value: data.headline } : null,
                    data.company ? { key: 'company', label: 'COMPANY', value: data.company } : null,
                ].filter(Boolean),
            },
            barcodes: [
                {
                    format: 'PKBarcodeFormatQR',
                    message: publicUrl,
                    messageEncoding: 'iso-8859-1',
                    altText: 'Scan Career Identity',
                },
            ],
        };

        const pass = new PKPass(
            {
                'pass.json': Buffer.from(JSON.stringify(passJson)),
                'icon.png': iconPng,
                'icon@2x.png': iconPng,
                'logo.png': iconPng,
                'logo@2x.png': iconPng,
            },
            {
                signerCert: credentials.signerCert,
                signerKey: credentials.signerKey,
                signerKeyPassphrase: credentials.signerKeyPassphrase,
                wwdr: credentials.wwdr,
            },
        );

        pass.setBarcodes({
            format: 'PKBarcodeFormatQR',
            message: publicUrl,
            messageEncoding: 'iso-8859-1',
            altText: 'Scan Career Identity',
        });

        return pass.getAsBuffer();
    }
}

export const walletService = new WalletService();
