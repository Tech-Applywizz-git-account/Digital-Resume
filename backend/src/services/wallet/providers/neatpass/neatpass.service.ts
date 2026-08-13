/**
 * NeatPass Wallet Provider
 * ------------------------------------------------------------------
 * Generates a branded PDF business card from an HTML/CSS template
 * using Puppeteer (headless Chrome). The user downloads this PDF
 * directly.
 *
 * Implements the WalletProvider interface defined in wallet.types.ts.
 * No Apple certificates or paid infrastructure required.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import type { WalletProvider, WalletCardData, WalletProviderType } from '../../wallet.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CARD_WIDTH = 800;
const CARD_HEIGHT = 480;

class NeatPassProvider implements WalletProvider {
    readonly type: WalletProviderType = 'neatpass';
    readonly requiresAppleCredentials = false;
    readonly label = 'Wallet Card PDF';

    private getTemplatePath(): string {
        return path.resolve(__dirname, 'templates', 'WalletCard', 'index.html');
    }

    getMimeType(): string {
        return 'application/pdf';
    }

    getFileExtension(): string {
        return 'pdf';
    }

    isAvailable(): boolean {
        return true; // No external credentials required
    }

    getUnavailableMessage(): string {
        return 'NeatPass provider is always available.';
    }

    async generateCard(data: WalletCardData): Promise<Buffer> {
        // Read template fresh on every call so template changes take effect without restart
        const templateHtml = readFileSync(this.getTemplatePath(), 'utf-8');
        // 1. Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(data.careerIdentityUrl, {
            width: 200,
            margin: 1,
            color: { dark: '#0B4F6C', light: '#FFFFFF' },
        });

        // 2. Build company HTML
        const companyHtml = data.company
            ? '<div class="company">' + this.escapeHtml(data.company) + '</div>'
            : '';

        // 3. Build contact HTML
        const contactLines: string[] = [];
        if (data.email) {
            contactLines.push('<div class="contact-row"><span class="contact-icon">&#x2709;</span><span class="contact-value">' + this.escapeHtml(data.email) + '</span></div>');
        }
        if (data.phone) {
            contactLines.push('<div class="contact-row"><span class="contact-icon">&#x1F4DE;</span><span class="contact-value">' + this.escapeHtml(data.phone) + '</span></div>');
        }
        if (data.location) {
            contactLines.push('<div class="contact-row"><span class="contact-icon">&#x1F4CD;</span><span class="contact-value">' + this.escapeHtml(data.location) + '</span></div>');
        }
        const contactHtml = contactLines.length > 0
            ? contactLines.join('\n')
            : '<div class="contact-row"><span class="contact-value" style="color:var(--muted)">No contact details</span></div>';

        // 4. Inject data into template
        let html = templateHtml;
        html = html.replace(/\{\{fullName\}\}/g, this.escapeHtml(data.fullName || 'Professional'));
        html = html.replace(/\{\{jobTitle\}\}/g, this.escapeHtml(data.jobTitle || data.headline || 'Professional'));
        html = html.replace(/\{\{companyHtml\}\}/g, companyHtml);
        html = html.replace(/\{\{contactHtml\}\}/g, contactHtml);
        html = html.replace(/\{\{careerIdentityUrl\}\}/g, this.escapeHtml(data.careerIdentityUrl));
        html = html.replace(/\{\{qrCodeDataUrl\}\}/g, qrCodeDataUrl);

        // 5. Render with Puppeteer and generate PDF
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

            const pdfBuffer = await page.pdf({
                width: CARD_WIDTH / 2 + 'px',  // PDF uses CSS px at 96dpi, screenshot was at 2x
                height: CARD_HEIGHT / 2 + 'px',
                printBackground: true,
                preferCSSPageSize: false,
                margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
            });

            return Buffer.from(pdfBuffer);
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

export const neatpassProvider = new NeatPassProvider();