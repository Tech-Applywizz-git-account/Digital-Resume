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

        const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX || 'career_identity';
        const classId = `${issuerId}.${classSuffix}`;
        const careerIdentityUrl = this.safeUrl(data.careerIdentityUrl);
        const linkedinUrl = this.safeUrl(data.linkedin);
        const imageUrl = this.safeUrl(data.profileImageUrl);
        const objectVersion = crypto
            .createHash('sha1')
            .update(JSON.stringify({
                castId: data.castId,
                careerIdentityUrl,
                fullName: data.fullName,
                jobTitle: data.jobTitle,
                headline: data.headline,
                company: data.company,
                email: data.email,
                phone: data.phone,
                location: data.location,
            }))
            .digest('hex')
            .slice(0, 10);
        const objectId = `${issuerId}.ci_${this.safeId(data.castId).slice(0, 40)}_${objectVersion}`;
        const origins = (process.env.GOOGLE_WALLET_ORIGINS || process.env.CORS_ORIGIN || '')
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean);

        const claims = {
            iss: account.client_email,
            aud: 'google',
            typ: 'savetowallet',
            iat: Math.floor(Date.now() / 1000),
            origins,
            payload: {
                genericClasses: [
                    {
                        id: classId,
                        issuerName: 'ApplyWizz',
                        reviewStatus: 'UNDER_REVIEW',
                        classTemplateInfo: {
                            cardTemplateOverride: {
                                cardRowTemplateInfos: [
                                    {
                                        twoItems: {
                                            startItem: {
                                                firstValue: { fields: [{ fieldPath: "object.textModulesData['email']" }] },
                                            },
                                            endItem: {
                                                firstValue: { fields: [{ fieldPath: "object.textModulesData['location']" }] },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                ],
                genericObjects: [
                    {
                        id: objectId,
                        classId,
                        state: 'ACTIVE',
                        hexBackgroundColor: '#0A0E14',
                        heroImage: imageUrl
                            ? { sourceUri: { uri: imageUrl }, contentDescription: this.localized(data.fullName || 'Portrait') }
                            : undefined,
                        cardTitle: this.localized('Career Identity'),
                        header: this.localized(data.fullName || 'Professional'),
                        subheader: this.localized(data.jobTitle || data.headline || 'ApplyWizz'),
                        logo: imageUrl
                            ? { sourceUri: { uri: imageUrl }, contentDescription: this.localized(data.fullName || 'Portrait') }
                            : undefined,
                        barcode: {
                            type: 'QR_CODE',
                            value: careerIdentityUrl || data.castId,
                            alternateText: 'Scan Career Identity',
                        },
                        textModulesData: [
                            data.email ? { id: 'email', header: 'EMAIL', body: data.email } : null,
                            data.phone ? { id: 'phone', header: 'PHONE', body: data.phone } : null,
                            data.location ? { id: 'location', header: 'LOCATION', body: data.location } : null,
                            data.company ? { id: 'company', header: 'COMPANY', body: data.company } : null,
                        ].filter(Boolean),
                        linksModuleData: {
                            uris: [
                                careerIdentityUrl ? { uri: careerIdentityUrl, description: 'Open Career Identity' } : null,
                                linkedinUrl ? { uri: linkedinUrl, description: 'LinkedIn' } : null,
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
