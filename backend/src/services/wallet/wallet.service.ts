/**
 * Wallet Service (Provider Orchestrator + Native Apple Pass)
 */
import { PKPass } from 'passkit-generator';
import { neatpassProvider } from './providers/neatpass/neatpass.service.js';
import { tap2Provider } from './providers/tap2/tap2.service.js';
import { googleWalletService } from './providers/google/googleWallet.service.js';
import { googleBannerService } from './providers/google/googleBanner.service.js';
import { applePassAssetsService } from './providers/apple/applePassAssets.service.js';
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

    async generateGoogleBanner(castId: string, authenticatedUserId?: string): Promise<Buffer> {
        const { record, userId } = await assertWalletAccess(castId, authenticatedUserId);
        const data = await loadWalletCardData(castId, record, userId);
        return googleBannerService.generateBanner(data);
    }

    async generatePass(castId: string, authenticatedUserId?: string): Promise<Buffer> {
        const credentials = this.loadCredentials();
        if (!credentials) {
            throw new Error('Apple Wallet pass generation is not configured. Missing PassKit credentials.');
        }

        const { record, userId } = await assertWalletAccess(castId, authenticatedUserId);
        const data = await loadWalletCardData(castId, record, userId);
        const {
            stripPng,
            strip2xPng,
            iconPng,
            icon2xPng,
            logoPng,
            logo2xPng,
        } = await applePassAssetsService.generatePassAssets(data);
        const publicUrl = data.careerIdentityUrl || publicCareerIdentityUrl(castId);

        const makeLink = (key: string, label: string, title: string, url?: string | null) => {
            if (!url) return null;
            let clean = url.trim();
            if (!clean) return null;
            if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
                clean = `https://${clean}`;
            }
            return {
                key,
                label,
                value: title,
                attributedValue: `<a href="${clean.replace(/"/g, '&quot;')}">${title} ↗</a>`,
            };
        };

        const makeMailto = (email?: string | null) => {
            if (!email) return null;
            const clean = email.trim();
            if (!clean) return null;
            return {
                key: 'email',
                label: 'CONTACT EMAIL',
                value: clean,
            };
        };

        const makeTel = (phone?: string | null) => {
            if (!phone) return null;
            const clean = phone.trim();
            if (!clean) return null;
            return {
                key: 'phone',
                label: 'PHONE NUMBER',
                value: clean,
            };
        };

        const passJson = {
            formatVersion: 1,
            passTypeIdentifier: credentials.passTypeIdentifier,
            teamIdentifier: credentials.teamIdentifier,
            organizationName: 'ApplyWizz',
            description: `Career Identity — ${data.fullName || 'Professional'}`,
            serialNumber: `ci-${castId}`.slice(0, 64),
            foregroundColor: 'rgb(241, 251, 254)', // Ice White #F1FBFE
            backgroundColor: 'rgb(15, 29, 49)',    // Deep Navy #0F1D31
            labelColor: 'rgb(122, 250, 86)',       // Vibrant Lime #7AFA56
            storeCard: {
                backFields: [
                    makeLink('profile', 'CAREER IDENTITY PROFILE', 'View Full Digital Resume', publicUrl),
                    makeLink('resume', 'RESUME (LATEST PDF)', 'Download Resume (PDF)', data.resumeUrl),
                    makeLink('video', 'INTRO VIDEO (60 SEC)', 'Watch Intro Video', data.videoUrl),
                    makeLink('portfolio', 'PORTFOLIO & WORK', 'Open Portfolio & Case Studies', data.portfolioUrl),
                    makeLink('linkedin', 'LINKEDIN PROFILE', 'Connect on LinkedIn', data.linkedin),
                    makeMailto(data.email),
                    makeTel(data.phone),
                    data.headline ? { key: 'headline', label: 'PROFESSIONAL HEADLINE', value: data.headline } : null,
                    data.company ? { key: 'company', label: 'CURRENT / TARGET COMPANY', value: data.company } : null,
                ].filter(Boolean),
            },
            barcodes: [
                {
                    format: 'PKBarcodeFormatQR',
                    message: publicUrl,
                    messageEncoding: 'iso-8859-1',
                    altText: 'View my full digital resume',
                },
            ],
        };

        const pass = new PKPass(
            {
                'pass.json': Buffer.from(JSON.stringify(passJson)),
                'icon.png': iconPng,
                'icon@2x.png': icon2xPng,
                'logo.png': logoPng,
                'logo@2x.png': logo2xPng,
                'strip.png': stripPng,
                'strip@2x.png': strip2xPng,
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
            altText: 'Scan to view verified Career Identity',
        });

        return pass.getAsBuffer();
    }
}

export const walletService = new WalletService();
