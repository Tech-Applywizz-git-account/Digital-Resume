/**
 * Wallet Card Service (NeatPass Integration)
 * ------------------------------------------------------------------
 * Generates a branded PNG business card from an HTML/CSS template
 * using Puppeteer (headless Chrome). The user downloads this PNG and
 * uploads it to NeatPass (free) to create an Apple Wallet pass.
 *
 * Why Puppeteer over Jimp (manual canvas drawing):
 * - CSS-driven design -- template changes = visual changes, no pixel math
 * - Mirrors Career Identity page design language via CSS custom properties
 * - Future-proof: when CI is redesigned, just update the template CSS
 * - Team-friendly: any frontend dev can edit the HTML/CSS template
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WalletCardData {
    fullName: string | null;
    jobTitle: string | null;
    headline: string | null;
    location: string | null;
    email: string | null;
    phone: string | null;
    profileImageUrl: string | null;
    careerIdentityUrl: string;
    castId: string;
    company: string | null;
}

const CARD_WIDTH = 800;
const CARD_HEIGHT = 480;

class WalletCardService {
    private templateHtml: string;

    constructor() {
        const templatePath = path.resolve(__dirname, 'walletCard.template.html');
        this.templateHtml = readFileSync(templatePath, 'utf-8');
    }

    /**
     * Generates a branded PNG wallet card for a Career Identity profile.
     * Renders an HTML template with Puppeteer and returns a PNG Buffer.
     */
    async generateWalletCard(data: WalletCardData): Promise<Buffer> {
        // 1. Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(data.careerIdentityUrl, {
            width: 200,
            margin: 1,
            color: { dark: '#0B4F6C', light: '#FFFFFF' },
        });

        // 2. Build profile image HTML
        let profileImageHtml: string;
        if (data.profileImageUrl) {
            const safeUrl = data.profileImageUrl.replace(/"/g, '"');
            profileImageHtml = '<img class="profile-photo" src="' + safeUrl + '" alt="Profile" />';
        } else {
            profileImageHtml = '<div class="profile-photo-placeholder">&#x1F464;</div>';
        }

        // 3. Build company HTML
        const companyHtml = data.company
            ? '<div class="company">' + this.escapeHtml(data.company) + '</div>'
            : '';

        // 4. Build contact HTML
        const contactLines: string[] = [];
        if (data.email) {
            contactLines.push('<div class="contact-item"><span class="contact-icon">&#x2709;</span><span class="contact-text">' + this.escapeHtml(data.email) + '</span></div>');
        }
        if (data.phone) {
            contactLines.push('<div class="contact-item"><span class="contact-icon">&#x1F4DE;</span><span class="contact-text">' + this.escapeHtml(data.phone) + '</span></div>');
        }
        if (data.location) {
            contactLines.push('<div class="contact-item"><span class="contact-icon">&#x1F4CD;</span><span class="contact-text">' + this.escapeHtml(data.location) + '</span></div>');
        }
        const contactHtml = contactLines.length > 0
            ? contactLines.join('\n')
            : '<div class="contact-item" style="color: var(--muted);">No contact details</div>';

        // 5. Sanitize and inject data into template
        const safeFullName = this.escapeHtml(data.fullName || 'Professional');
        const safeJobTitle = this.escapeHtml(data.jobTitle || data.headline || 'Professional');
        const safeUrl = this.escapeHtml(data.careerIdentityUrl);

        let html = this.templateHtml;
        html = html.replace(/\{\{fullName\}\}/g, safeFullName);
        html = html.replace(/\{\{jobTitle\}\}/g, safeJobTitle);
        html = html.replace(/\{\{companyHtml\}\}/g, companyHtml);
        html = html.replace(/\{\{profileImageHtml\}\}/g, profileImageHtml);
        html = html.replace(/\{\{contactHtml\}\}/g, contactHtml);
        html = html.replace(/\{\{careerIdentityUrl\}\}/g, safeUrl);
        html = html.replace(/\{\{qrCodeDataUrl\}\}/g, qrCodeDataUrl);

        // 6. Render with Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });

        try {
            const page = await browser.newPage();
            await page.setViewport({
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                deviceScaleFactor: 2,
            });

            await page.setContent(html, {
                waitUntil: 'networkidle0' as any,
                timeout: 30000,
            });

            await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {
                // Timeout acceptable -- continue with what loaded
            });

            const pngBuffer = await page.screenshot({
                type: 'png',
                clip: {
                    x: 0,
                    y: 0,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                },
            });

            return Buffer.from(pngBuffer);
        } finally {
            await browser.close();
        }
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#039;');
    }
}

export const walletCardService = new WalletCardService();