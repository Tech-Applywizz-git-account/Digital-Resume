/**
 * Visual Career Identity card renderer.
 * Uses Sharp + SVG so Render/Linux does not need Chrome/Puppeteer.
 */
import sharp from 'sharp';
import QRCode from 'qrcode';
import type { WalletProvider, WalletCardData, WalletProviderType } from '../../wallet.types.js';

const CARD_WIDTH = 1012;
const CARD_HEIGHT = 638;

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
        const qrCodeDataUrl = await QRCode.toDataURL(data.careerIdentityUrl, {
            width: 420,
            margin: 1,
            color: { dark: '#14110C', light: '#F7F1E3' },
            errorCorrectionLevel: 'H',
        });

        const svg = this.buildCardSvg(data, qrCodeDataUrl);
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

    private buildCardSvg(data: WalletCardData, qrCodeDataUrl: string): string {
        const fullName = this.escapeXml(data.fullName || 'Professional');
        const company = data.company ? this.escapeXml(data.company) : '';

        const chips: string[] = [];
        if (data.verified) chips.push('Verified');
        if (data.openToWork) chips.push('Open to work');
        if (data.openToRelocate) chips.push('Relocate');
        if (data.remote) chips.push('Remote');
        if (data.immediateJoiner) chips.push('Immediate joiner');

        const pad = 8;
        const borderW = CARD_WIDTH - pad * 2;
        const borderH = CARD_HEIGHT - pad * 2;
        const centerY = 338;
        const textX = 72;
        const qrSize = 236;
        const qrX = 704;
        const qrY = centerY - qrSize / 2;

        const chipSvg = chips.map((chip, index) => {
            const x = textX + (index % 2) * 150;
            const y = centerY + 48 + Math.floor(index / 2) * 32;
            return `<rect x="${x}" y="${y}" rx="13" ry="13" width="140" height="24" fill="rgba(200,164,90,0.12)" stroke="rgba(200,164,90,0.4)"/>
            <text x="${x + 70}" y="${y + 16}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" letter-spacing="1.1" fill="#E8D5A3">${this.escapeXml(chip.toUpperCase())}</text>`;
        }).join('');

        const contactLines = [data.email, data.phone, data.location].filter(Boolean) as string[];
        const contactStartY = centerY + (chips.length ? 48 + Math.ceil(chips.length / 2) * 32 + 20 : 56);
        const contactSvg = contactLines.map((line, index) => (
            `<text x="${textX}" y="${contactStartY + index * 24}" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#D9C8A0">${this.escapeXml(line)}</text>`
        )).join('');

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#121722"/>
      <stop offset="48%" stop-color="#07090D"/>
      <stop offset="100%" stop-color="#0B0E14"/>
    </linearGradient>
    <radialGradient id="goldGlow" cx="18%" cy="40%" r="70%">
      <stop offset="0%" stop-color="rgba(200,164,90,0.16)"/>
      <stop offset="100%" stop-color="rgba(200,164,90,0)"/>
    </radialGradient>
  </defs>

  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="18" fill="url(#bg)"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="18" fill="url(#goldGlow)"/>
  <rect x="${pad}" y="${pad}" width="${borderW}" height="${borderH}" rx="14" fill="none" stroke="#C8A45A" stroke-width="1.5"/>

  <text x="28" y="36" font-family="Arial, Helvetica, sans-serif" font-size="11" letter-spacing="3.2" fill="#C8A45A">CAREER IDENTITY</text>
  <text x="984" y="36" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="11" letter-spacing="3.2" fill="#D9C8A0">APPLYWIZZ</text>
  <line x1="28" y1="48" x2="984" y2="48" stroke="rgba(200,164,90,0.45)"/>

  <text x="${textX}" y="${centerY - 36}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#E8D5A3">Hi, I'm</text>
  <text x="${textX}" y="${centerY + 12}" font-family="Georgia, serif" font-size="44" font-weight="700" fill="#F8EED4">${fullName}</text>
  ${company ? `<text x="${textX}" y="${centerY + 42}" font-family="Arial, Helvetica, sans-serif" font-size="14" letter-spacing="2" fill="#9A8B72">${company}</text>` : ''}
  ${chipSvg}
  ${contactSvg}

  <rect x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" rx="22" fill="#F7F1E3"/>
  <image href="${qrCodeDataUrl}" x="${qrX + 14}" y="${qrY + 14}" width="${qrSize - 28}" height="${qrSize - 28}"/>
  <text x="${qrX + qrSize / 2}" y="${qrY + qrSize + 24}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" letter-spacing="2" fill="#9A8B72">SCAN TO OPEN PROFILE</text>
</svg>`;
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
