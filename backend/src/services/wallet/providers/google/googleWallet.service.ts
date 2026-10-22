/**
 * Google Wallet Generic pass (Save to Wallet JWT).
 * Requires a Google Wallet issuer ID and a service-account JSON key.
 *
 * Env:
 *   GOOGLE_WALLET_ISSUER_ID
 *   GOOGLE_WALLET_SERVICE_ACCOUNT_JSON   (raw JSON or base64)
 *   GOOGLE_WALLET_CLASS_SUFFIX           (optional, default career_identity)
 *   GOOGLE_WALLET_ORIGINS                (optional comma-separated)
 */
import crypto from 'node:crypto';
import type { WalletCardData } from '../../wallet.types.js';

interface GoogleServiceAccount {
    client_email: string;
    private_key: string;
}

export class GoogleWalletService {
    isAvailable(): boolean {
        return !!(process.env.GOOGLE_WALLET_ISSUER_ID && this.loadServiceAccount());
    }

    getUnavailableMessage(): string {
        return 'Google Wallet is not configured. Set GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_SERVICE_ACCOUNT_JSON.';
    }

    createSaveUrl(data: WalletCardData): string {
        const account = this.loadServiceAccount();
        const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
        if (!account || !issuerId) {
            throw new Error(this.getUnavailableMessage());
        }

        const classId = process.env.GOOGLE_WALLET_CLASS_ID || `${issuerId}.${process.env.GOOGLE_WALLET_CLASS_SUFFIX || 'career_identity'}`;
        const careerIdentityUrl = this.safeUrl(data.careerIdentityUrl);
        const linkedinUrl = this.safeUrl(data.linkedin);
        const resumeUrl = this.safeUrl(data.resumeUrl);
        const videoUrl = this.safeUrl(data.videoUrl || (careerIdentityUrl ? `${careerIdentityUrl}?mode=video` : null));
        const portfolioUrl = this.safeUrl(data.portfolioUrl);
        const bookingUrl = this.safeUrl(data.bookingUrl || (careerIdentityUrl ? `${careerIdentityUrl}?action=schedule` : null));
        const aiChatUrl = this.safeUrl(careerIdentityUrl ? `${careerIdentityUrl}?mode=chat` : null);
        const emailActionUrl = data.email
            ? this.safeUrl(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(data.email)}`)
            : null;

        const baseUrl = (
            process.env.BACKEND_PUBLIC_URL ||
            process.env.API_BASE_URL ||
            process.env.CAREER_IDENTITY_PUBLIC_URL ||
            'https://applywizz.com'
        ).replace(/\/$/, '');
        const bannerUrl = `${baseUrl}/api/v1/wallet/${encodeURIComponent(data.castId)}/banner.png?v=${Date.now()}`;
        const logoUrl = `${baseUrl}/logo2.jpg?v=1`;

        const objectVersion = Date.now().toString(36);
        const objectId = `${issuerId}.ci_${this.safeId(data.castId).slice(0, 30)}_${objectVersion}`;
        const isHttpsPublic = (urlStr: string) => {
            try {
                const u = new URL(urlStr);
                return u.protocol === 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1';
            } catch {
                return false;
            }
        };

        // Only attach the dynamic hero banner if a public backend URL is explicitly configured
        // (e.g. deployed on Render or an active HTTPS tunnel). Otherwise omit it so local testing
        // saves cleanly without Google crashing on dead or unreachable image endpoints.
        const hasPublicBackend = !!process.env.BACKEND_PUBLIC_URL && isHttpsPublic(process.env.BACKEND_PUBLIC_URL);

        const heroImage = hasPublicBackend && isHttpsPublic(bannerUrl)
            ? {
                sourceUri: { uri: bannerUrl },
                contentDescription: this.localized(data.fullName ? `${data.fullName} - Career Identity` : 'Career Identity Banner'),
            }
            : undefined;

        const logoImage = hasPublicBackend && isHttpsPublic(logoUrl)
            ? {
                sourceUri: { uri: logoUrl },
                contentDescription: this.localized('Apply Wizz Logo'),
            }
            : undefined;

        // Note: For direct window.open() links, omitting origins allows seamless saving
        // without cross-origin tab restrictions on pay.google.com.
        const claims: Record<string, any> = {
            iss: account.client_email,
            aud: 'google',
            typ: 'savetowallet',
            iat: Math.floor(Date.now() / 1000),
            payload: {
                genericClasses: [
                    {
                        id: classId,
                        issuerName: 'Apply Wizz',
                        reviewStatus: (process.env.GOOGLE_WALLET_REVIEW_STATUS || 'UNDER_REVIEW') as any,
                    },
                ],
                genericObjects: [
                    {
                        id: objectId,
                        classId,
                        state: 'ACTIVE',
                        hexBackgroundColor: '#0F1D31',
                        heroImage,
                        cardTitle: this.localized('Apply Wizz'),
                        header: this.localized(data.fullName || 'Digital Resume'),
                        subheader: this.localized(data.jobTitle || 'Digital Resume Card'),
                        logo: logoImage,
                        barcode: {
                            type: 'QR_CODE',
                            value: careerIdentityUrl || data.castId,
                            alternateText: 'View my full digital resume',
                        },
                        textModulesData: [
                            // 3-Stat Metric Row
                            { id: 'experience', header: 'EXPERIENCE', body: `${data.experienceYears || '3'} yrs` },
                            { id: 'skills', header: 'SKILLS', body: `${data.skillsCount || 12}` },
                            { id: 'projects', header: 'PROJECTS', body: `${data.projectsCount || 8}` },
                            // Details Screen Info
                            data.location ? { id: 'location', header: 'LOCATION', body: data.location } : null,
                            data.email ? { id: 'email', header: 'EMAIL', body: data.email } : null,
                            data.phone ? { id: 'phone', header: 'PHONE', body: data.phone } : null,
                            data.company ? { id: 'company', header: 'COMPANY', body: data.company } : null,
                        ].filter(Boolean),
                        linksModuleData: {
                            uris: [
                                resumeUrl ? { uri: resumeUrl, description: 'View Resume (Latest PDF)' } : null,
                                videoUrl ? { uri: videoUrl, description: 'Intro Video (60 sec)' } : null,
                                portfolioUrl ? { uri: portfolioUrl, description: 'Portfolio & Case Studies' } : null,
                                aiChatUrl ? { uri: aiChatUrl, description: 'AI Recruiter Q&A' } : null,
                                careerIdentityUrl ? { uri: careerIdentityUrl, description: 'View Full Profile' } : null,
                                emailActionUrl ? { uri: emailActionUrl, description: 'Email Me' } : null,
                                linkedinUrl ? { uri: linkedinUrl, description: 'LinkedIn Profile' } : null,
                            ].filter(Boolean),
                        },
                    },
                ],
            },
        };

        const jwt = this.signRs256(claims, account.private_key);
        return `https://pay.google.com/gp/v/save/${jwt}`;
    }

    private localized(value: string) {
        return { defaultValue: { language: 'en-US', value } };
    }

    private safeId(raw: string): string {
        return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
    }

    private safeUrl(raw?: string | null): string | null {
        if (!raw) return null;
        const value = raw.trim();
        if (!value) return null;

        const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        try {
            const url = new URL(candidate);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return null;
            }
            return url.toString();
        } catch {
            return null;
        }
    }

    private loadServiceAccount(): GoogleServiceAccount | null {
        const raw = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY;
        if (!raw) return null;
        try {
            const json = raw.trim().startsWith('{')
                ? raw
                : Buffer.from(raw, 'base64').toString('utf8');
            const parsed = JSON.parse(json) as GoogleServiceAccount;
            if (!parsed.client_email || !parsed.private_key) return null;
            return parsed;
        } catch {
            return null;
        }
    }

    private signRs256(payload: object, privateKeyPem: string): string {
        const header = { alg: 'RS256', typ: 'JWT' };
        const encode = (value: object) =>
            Buffer.from(JSON.stringify(value)).toString('base64url');
        const unsigned = `${encode(header)}.${encode(payload)}`;
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(unsigned);
        signer.end();
        const signature = signer.sign(privateKeyPem, 'base64url');
        return `${unsigned}.${signature}`;
    }
}

export const googleWalletService = new GoogleWalletService();
