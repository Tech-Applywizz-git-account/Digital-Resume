/**
 * Visual Career Identity card renderer.
 * Uses Sharp + SVG so Render/Linux does not need Chrome/Puppeteer.
 */
import sharp from 'sharp';
import QRCode from 'qrcode';
import type { WalletProvider, WalletCardData, WalletProviderType } from '../../wallet.types.js';

const CARD_WIDTH = 1050;
const CARD_HEIGHT = 660;

class NeatPassProvider implements WalletProvider {
    readonly type: WalletProviderType = 'neatpass';
    readonly requiresAppleCredentials = false;
    readonly label = 'Career Identity Wallet Card';

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
        const [qrCodeDataUrl, portraitDataUrl] = await Promise.all([
            QRCode.toDataURL(data.careerIdentityUrl, {
                width: 420,
                margin: 1,
                color: { dark: '#14110C', light: '#F7F1E3' },
                errorCorrectionLevel: 'H',
            }),
            this.loadPortrait(data.profileImageUrl),
        ]);

        const svg = this.buildCardSvg(data, qrCodeDataUrl, portraitDataUrl);
        const cardPng = await sharp(Buffer.from(svg))
            .resize(CARD_WIDTH * 2, CARD_HEIGHT * 2)
            .png()
            .toBuffer();

        const initials = this.initials(data.fullName);
        const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="174" height="174" viewBox="0 0 58 58">
  <defs>
    <radialGradient id="g" cx="30%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#2A2418"/>
      <stop offset="100%" stop-color="#0A0E14"/>
    </radialGradient>
  </defs>
  <rect width="58" height="58" fill="url(#g)"/>
  <text x="29" y="36" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="#E8D5A3">${this.escapeXml(initials)}</text>
</svg>`;
        const iconPng = await sharp(Buffer.from(iconSvg)).png().toBuffer();

        return { cardPng, iconPng };
    }

    private buildCardSvg(
        data: WalletCardData,
        qrCodeDataUrl: string,
        portraitDataUrl: string | null,
    ): string {
        const fullName = this.escapeXml(data.fullName || 'Professional');
        const greeting = this.escapeXml(data.jobTitle || data.headline || "Hi ;✋, I'm");
        const company = data.company ? this.escapeXml(data.company) : '';
        const url = this.escapeXml(data.careerIdentityUrl);
        const initials = this.escapeXml(this.initials(data.fullName));

        const chips: string[] = [];
        if (data.verified) chips.push('Verified');
        if (data.openToWork) chips.push('Open to work');
        if (data.openToRelocate) chips.push('Relocate');
        if (data.remote) chips.push('Remote');
        if (data.immediateJoiner) chips.push('Immediate joiner');

        const chipSvg = chips.map((chip, index) => {
            const x = 300 + (index % 3) * 132;
            const y = 318 + Math.floor(index / 3) * 36;
            return `<rect x="${x}" y="${y}" rx="14" ry="14" width="122" height="26" fill="rgba(200,164,90,0.12)" stroke="rgba(200,164,90,0.4)"/>
            <text x="${x + 61}" y="${y + 17}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" letter-spacing="1.2" fill="#E8D5A3">${this.escapeXml(chip.toUpperCase())}</text>`;
        }).join('');

        const contactLines = [data.email, data.phone, data.location].filter(Boolean) as string[];
        const contactSvg = contactLines.map((line, index) => (
            `<text x="300" y="${410 + index * 24}" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#D9C8A0">${this.escapeXml(line)}</text>`
        )).join('');

        const portrait = portraitDataUrl
            ? `<image href="${portraitDataUrl}" x="48" y="150" width="214" height="348" preserveAspectRatio="xMidYMid slice" clip-path="url(#portraitClip)"/>`
            : `<rect x="48" y="150" width="214" height="348" rx="24" fill="#161B24"/>
               <text x="155" y="340" text-anchor="middle" font-family="Georgia, serif" font-size="58" fill="#E8D5A3">${initials}</text>`;

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#121722"/>
      <stop offset="48%" stop-color="#07090D"/>
      <stop offset="100%" stop-color="#0B0E14"/>
    </linearGradient>
    <radialGradient id="goldGlow" cx="12%" cy="0%" r="70%">
      <stop offset="0%" stop-color="rgba(200,164,90,0.18)"/>
      <stop offset="100%" stop-color="rgba(200,164,90,0)"/>
    </radialGradient>
    <linearGradient id="frameGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E8D5A3"/>
      <stop offset="40%" stop-color="#C8A45A"/>
      <stop offset="100%" stop-color="#8A6A2E"/>
    </linearGradient>
    <clipPath id="portraitClip">
      <rect x="48" y="150" width="214" height="348" rx="24"/>
    </clipPath>
  </defs>

  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#goldGlow)"/>
  <rect x="18" y="18" width="1014" height="624" rx="28" fill="none" stroke="rgba(200,164,90,0.38)"/>

  <text x="52" y="68" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="4" fill="#C8A45A">CAREER IDENTITY</text>
  <text x="998" y="68" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="4" fill="#D9C8A0">APPLYWIZZ</text>
  <line x1="52" y1="92" x2="998" y2="92" stroke="rgba(200,164,90,0.45)"/>

  <rect x="42" y="144" width="226" height="360" rx="30" fill="url(#frameGold)"/>
  ${portrait}

  <text x="300" y="214" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#E8D5A3">${greeting}</text>
  <text x="300" y="278" font-family="Georgia, serif" font-size="46" font-weight="700" fill="#F8EED4">${fullName}</text>
  ${company ? `<text x="300" y="312" font-family="Arial, Helvetica, sans-serif" font-size="14" letter-spacing="2" fill="#9A8B72">${company}</text>` : ''}
  ${chipSvg}
  ${contactSvg}

  <rect x="800" y="168" width="198" height="198" rx="28" fill="#F7F1E3"/>
  <image href="${qrCodeDataUrl}" x="816" y="184" width="166" height="166"/>
  <text x="899" y="394" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" letter-spacing="2.2" fill="#9A8B72">SCAN TO OPEN PROFILE</text>

  <text x="52" y="618" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#D9C8A0">${url}</text>
  <text x="998" y="618" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="11" letter-spacing="2" fill="#9A8B72">MEMBER PASS</text>
</svg>`;
    }

    private async loadPortrait(url?: string | null): Promise<string | null> {
        if (!url) return null;
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!response.ok) return null;
            const buffer = Buffer.from(await response.arrayBuffer());
            const png = await sharp(buffer).resize(428, 696, { fit: 'cover' }).png().toBuffer();
            return `data:image/png;base64,${png.toString('base64')}`;
        } catch {
            return null;
        }
    }

    private initials(name: string | null): string {
        if (!name) return 'CI';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'CI';
    }

    private escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

export const neatpassProvider = new NeatPassProvider();
