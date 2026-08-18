/**
 * Visual Career Identity card — luxury pass used as the source image
 * for Apple Wallet / Google Wallet and for admin preview.
 */
import os from 'node:os';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import type { WalletProvider, WalletCardData, WalletProviderType } from '../../wallet.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CARD_WIDTH = 1050;
const CARD_HEIGHT = 660;

class NeatPassProvider implements WalletProvider {
    readonly type: WalletProviderType = 'neatpass';
    readonly requiresAppleCredentials = false;
    readonly label = 'Career Identity Wallet Card';

    private getTemplatePath(): string {
        const candidates = [
            path.resolve(__dirname, 'templates', 'WalletCard', 'index.html'),
            path.resolve(process.cwd(), 'src/services/wallet/providers/neatpass/templates/WalletCard/index.html'),
            path.resolve(process.cwd(), 'dist/services/wallet/providers/neatpass/templates/WalletCard/index.html'),
        ];
        const found = candidates.find((candidate) => existsSync(candidate));
        if (!found) {
            throw new Error(`Wallet card template not found. Looked in: ${candidates.join(', ')}`);
        }
        return found;
    }

    getMimeType(): string {
        return 'image/png';
    }

    getFileExtension(): string {
        return 'png';
    }

    isAvailable(): boolean {
        return true;
    }

    getUnavailableMessage(): string {
        return 'Visual wallet card provider is always available.';
    }

    async generateCard(data: WalletCardData): Promise<Buffer> {
        const { cardPng } = await this.renderAssets(data);
        return cardPng;
    }

    async renderAssets(data: WalletCardData): Promise<{ cardPng: Buffer; iconPng: Buffer }> {
        const templateHtml = readFileSync(this.getTemplatePath(), 'utf-8');
        const qrCodeDataUrl = await QRCode.toDataURL(data.careerIdentityUrl, {
            width: 420,
            margin: 0,
            color: { dark: '#14110C', light: '#F7F1E3' },
            errorCorrectionLevel: 'H',
        });

        const initials = this.initials(data.fullName);
        const portraitHtml = data.profileImageUrl
            ? `<img src="${this.escapeAttr(data.profileImageUrl)}" alt="" />`
            : `<div class="mono">${this.escapeHtml(initials)}</div>`;
        const heroBackgroundCss = data.profileImageUrl
            ? `background-image:
                linear-gradient(90deg, rgba(7, 9, 13, 0.92) 0%, rgba(7, 9, 13, 0.78) 38%, rgba(7, 9, 13, 0.62) 100%),
                radial-gradient(900px 460px at 82% 48%, rgba(200,164,90,0.16), transparent 52%),
                url('${this.escapeAttr(data.profileImageUrl)}');`
            : `background-image:
                radial-gradient(1200px 420px at 12% -10%, rgba(200,164,90,0.16), transparent 55%),
                radial-gradient(700px 380px at 100% 120%, rgba(200,164,90,0.10), transparent 50%),
                linear-gradient(160deg, #121722 0%, #07090D 48%, #0B0E14 100%);`;

        const companyHtml = data.company
            ? `<div class="company">${this.escapeHtml(data.company)}</div>`
            : '';

        const chips: string[] = [];
        if (data.verified) chips.push('Verified');
        if (data.openToWork) chips.push('Open to work');
        if (data.openToRelocate) chips.push('Open to relocate');
        if (data.remote) chips.push('Remote');
        if (data.immediateJoiner) chips.push('Immediate joiner');
        const chipsHtml = chips.length
            ? `<div class="chips">${chips.map((c) => `<span class="chip">${this.escapeHtml(c)}</span>`).join('')}</div>`
            : '';

        const contactLines: string[] = [];
        if (data.email) contactLines.push(`<span>${this.escapeHtml(data.email)}</span>`);
        if (data.phone) contactLines.push(`<span>${this.escapeHtml(data.phone)}</span>`);
        if (data.location) contactLines.push(`<span>${this.escapeHtml(data.location)}</span>`);
        const contactHtml = contactLines.join('');

        let html = templateHtml
            .replace(/\{\{fullName\}\}/g, this.escapeHtml(data.fullName || 'Professional'))
            .replace(/\{\{jobTitle\}\}/g, this.escapeHtml(data.jobTitle || data.headline || 'Career Identity'))
            .replace(/\{\{companyHtml\}\}/g, companyHtml)
            .replace(/\{\{chipsHtml\}\}/g, chipsHtml)
            .replace(/\{\{contactHtml\}\}/g, contactHtml)
            .replace(/\{\{portraitHtml\}\}/g, portraitHtml)
            .replace(/\{\{heroBackgroundCss\}\}/g, heroBackgroundCss)
            .replace(/\{\{careerIdentityUrl\}\}/g, this.escapeHtml(data.careerIdentityUrl))
            .replace(/\{\{qrCodeDataUrl\}\}/g, qrCodeDataUrl);

        const executablePath = await this.resolveBrowserExecutable();
        if (process.env.PUPPETEER_EXECUTABLE_PATH && !existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
            delete process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        const browser = await puppeteer.launch({
            headless: true,
            ...(executablePath ? { executablePath } : {}),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--disable-software-rasterizer',
            ],
        });

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: CARD_WIDTH, height: CARD_HEIGHT, deviceScaleFactor: 2 });
            await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
            await page.waitForNetworkIdle({ idleTime: 400, timeout: 4000 }).catch(() => undefined);
            const cardShot = await page.screenshot({ type: 'png', omitBackground: false });

            await page.setViewport({ width: 58, height: 58, deviceScaleFactor: 3 });
            await page.setContent(`<!DOCTYPE html><html><head><style>
                html,body{margin:0;width:58px;height:58px;background:#0A0E14}
                .m{width:58px;height:58px;display:flex;align-items:center;justify-content:center;
                   background:radial-gradient(circle at 30% 20%,#2A2418,#0A0E14);
                   color:#E8D5A3;font:700 22px/1 "Georgia",serif;letter-spacing:.04em}
            </style></head><body><div class="m">CI</div></body></html>`, { waitUntil: 'load' });
            const iconShot = await page.screenshot({ type: 'png' });

            return {
                cardPng: Buffer.from(cardShot),
                iconPng: Buffer.from(iconShot),
            };
        } finally {
            await browser.close();
        }
    }

    private initials(name: string | null): string {
        if (!name) return 'CI';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'CI';
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private escapeAttr(text: string): string {
        return this.escapeHtml(text);
    }

    private async resolveBrowserExecutable(): Promise<string | undefined> {
        const explicit = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN;
        if (explicit && existsSync(explicit)) {
            return explicit;
        }

        const candidates = process.platform === 'win32'
            ? [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            ]
            : [
                '/usr/bin/chromium',
                '/usr/bin/chromium-browser',
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
            ];

        for (const candidate of candidates) {
            if (existsSync(candidate)) {
                return candidate;
            }
        }

        try {
            const bundled = await puppeteer.executablePath();
            if (bundled && existsSync(bundled)) {
                return bundled;
            }
        } catch {
            // Puppeteer has no bundled browser in this environment.
        }

        return this.findCachedChrome();
    }

    private findCachedChrome(): string | undefined {
        const roots = [
            process.env.PUPPETEER_CACHE_DIR,
            path.resolve(process.cwd(), '.cache/puppeteer'),
            path.join(os.homedir(), '.cache', 'puppeteer'),
            '/opt/render/.cache/puppeteer',
        ].filter((value): value is string => !!value);

        const names = process.platform === 'win32' ? ['chrome.exe'] : ['chrome', 'chromium', 'chromium-browser'];
        for (const root of roots) {
            const found = this.walkForBinary(root, names, 6);
            if (found) return found;
        }
        return undefined;
    }

    private walkForBinary(dir: string, names: string[], depth: number): string | undefined {
        if (depth < 0 || !existsSync(dir)) return undefined;
        let entries: string[] = [];
        try {
            entries = readdirSync(dir);
        } catch {
            return undefined;
        }

        for (const entry of entries) {
            const full = path.join(dir, entry);
            let stats;
            try {
                stats = statSync(full);
            } catch {
                continue;
            }
            if (stats.isFile() && names.includes(entry)) {
                return full;
            }
            if (stats.isDirectory()) {
                const nested = this.walkForBinary(full, names, depth - 1);
                if (nested) return nested;
            }
        }
        return undefined;
    }
}

export const neatpassProvider = new NeatPassProvider();
