import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import type { WalletCardData } from '../../wallet.types.js';

// Apple Wallet storeCard strip image dimensions (@2x for Retina displays)
const STRIP_WIDTH = 750;
const STRIP_HEIGHT = 246;

export class ApplePassAssetsService {
    /**
     * Generates all required Apple Wallet pass images:
     * - strip.png & strip@2x.png (hero banner across front of card)
     * - icon.png & icon@2x.png (notification / lock screen icon)
     * - logo.png & logo@2x.png (top-left pass header mark)
     */
    async generatePassAssets(data: WalletCardData): Promise<{
        stripPng: Buffer;
        strip2xPng: Buffer;
        iconPng: Buffer;
        icon2xPng: Buffer;
        logoPng: Buffer;
        logo2xPng: Buffer;
    }> {
        let avatarBase64: string | null = null;
        if (data.profileImageUrl) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3500);
                const res = await fetch(data.profileImageUrl, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const arrayBuf = await res.arrayBuffer();
                    const mime = res.headers.get('content-type') || 'image/jpeg';
                    avatarBase64 = `data:${mime};base64,${Buffer.from(arrayBuf).toString('base64')}`;
                }
            } catch {
                avatarBase64 = null;
            }
        }

        const stripSvg = this.buildStripSvg(data, avatarBase64);
        const strip2xPng = await sharp(Buffer.from(stripSvg))
            .resize(STRIP_WIDTH, STRIP_HEIGHT)
            .png({ quality: 98, compressionLevel: 7 })
            .toBuffer();

        const stripPng = await sharp(strip2xPng)
            .resize(Math.round(STRIP_WIDTH / 2), Math.round(STRIP_HEIGHT / 2))
            .png()
            .toBuffer();

        const { iconPng, icon2xPng } = await this.generateIcon(data);
        const { logoPng, logo2xPng } = await this.generateLogo();

        return {
            stripPng,
            strip2xPng,
            iconPng,
            icon2xPng,
            logoPng,
            logo2xPng,
        };
    }

    private buildStripSvg(data: WalletCardData, avatarBase64: string | null): string {
        const fullName = this.escapeXml(data.fullName || 'Professional');
        const jobTitle = this.escapeXml(data.jobTitle || data.headline || 'Digital Resume');
        const location = this.escapeXml(data.location || 'Remote');
        const statusText = data.openToWork !== false ? (data.openToWorkText || 'Open to opportunities') : 'Verified Professional';
        const initials = this.initials(data.fullName);
        const expYears = this.escapeXml(`${data.experienceYears ?? 0} yrs`);
        const skillsCount = this.escapeXml(`${data.skillsCount ?? 0}`);
        const projectsCount = this.escapeXml(`${data.projectsCount ?? 0}`);

        const avatarMarkup = avatarBase64
            ? `<image href="${avatarBase64}" x="30" y="30" width="130" height="130" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
            : `<circle cx="95" cy="95" r="65" fill="url(#monogramGrad)"/>
               <text x="95" y="110" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="700" fill="#FFFFFF">${this.escapeXml(initials)}</text>`;

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP_WIDTH}" height="${STRIP_HEIGHT}" viewBox="0 0 ${STRIP_WIDTH} ${STRIP_HEIGHT}">
  <defs>
    <!-- Base Gradient -->
    <linearGradient id="heroBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E1E1E"/>
      <stop offset="40%" stop-color="#0F1D31"/>
      <stop offset="100%" stop-color="#0A1626"/>
    </linearGradient>

    <!-- Top-Right Waves -->
    <linearGradient id="waveGreenToBlue" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7AFA56"/>
      <stop offset="100%" stop-color="#4174F6"/>
    </linearGradient>

    <linearGradient id="waveBlueToGreen" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4174F6" stop-opacity="0.95"/>
      <stop offset="60%" stop-color="#7AFA56" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#F1FBFE" stop-opacity="0.8"/>
    </linearGradient>

    <linearGradient id="ambientBlueGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4174F6" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#0F1D31" stop-opacity="0"/>
    </linearGradient>

    <!-- Avatar clip & gradient -->
    <clipPath id="avatarClip">
      <circle cx="95" cy="95" r="65"/>
    </clipPath>
    <linearGradient id="avatarBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7AFA56"/>
      <stop offset="50%" stop-color="#4174F6"/>
      <stop offset="100%" stop-color="#F1FBFE"/>
    </linearGradient>
    <linearGradient id="monogramGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E1E1E"/>
      <stop offset="50%" stop-color="#0F1D31"/>
      <stop offset="100%" stop-color="#4174F6"/>
    </linearGradient>
  </defs>

  <!-- 1. Background -->
  <rect width="${STRIP_WIDTH}" height="${STRIP_HEIGHT}" fill="url(#heroBaseGrad)"/>

  <!-- 2. Ambient Lighting Glow -->
  <circle cx="650" cy="40" r="160" fill="url(#ambientBlueGlow)"/>

  <!-- 3. Top-Right Wave Ribbon 1 -->
  <path d="M 480 0
           C 550 45, 600 55, 660 40
           C 710 25, 735 10, 750 0
           L 750 0 L 480 0 Z"
        fill="url(#waveGreenToBlue)" opacity="0.7"/>

  <!-- 4. Top-Right Wave Ribbon 2 -->
  <path d="M 510 0
           C 570 55, 630 65, 680 45
           C 720 28, 740 12, 750 0
           L 750 0 L 510 0 Z"
        fill="url(#waveBlueToGreen)" opacity="0.85"/>

  <!-- 5. Avatar Circle on the Left -->
  <circle cx="95" cy="95" r="68" fill="none" stroke="url(#avatarBorderGrad)" stroke-width="3.5"/>
  ${avatarMarkup}
  <!-- Online Dot -->
  <circle cx="145" cy="142" r="9" fill="#7AFA56" stroke="#0F1D31" stroke-width="2.5"/>

  <!-- 6. Candidate Info Next to Avatar -->
  <text x="185" y="68" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="800" fill="#F1FBFE" letter-spacing="0.3">${fullName}</text>
  <text x="185" y="98" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#7AFA56">${jobTitle}</text>
  
  <!-- Location & Status line -->
  <g transform="translate(185, 114)">
    <text x="0" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="400" fill="#A0B0C4">📍 ${location}</text>
    <circle cx="90" cy="12" r="4" fill="#7AFA56"/>
    <text x="102" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#7AFA56">${statusText}</text>
  </g>

  <!-- 7. Compact 3-Stat Metric Bar across the bottom -->
  <g transform="translate(30, 180)">
    <rect x="0" y="0" width="690" height="52" rx="12" fill="#0A1626" fill-opacity="0.88" stroke="#4174F6" stroke-opacity="0.35" stroke-width="1"/>
    
    <!-- Stat 1: Experience -->
    <text x="115" y="26" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#F1FBFE">${expYears}</text>
    <text x="115" y="42" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#7AFA56" letter-spacing="0.8">EXPERIENCE</text>

    <!-- Divider 1 -->
    <line x1="230" y1="10" x2="230" y2="42" stroke="#4174F6" stroke-opacity="0.3"/>

    <!-- Stat 2: Skills -->
    <text x="345" y="26" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#F1FBFE">${skillsCount}</text>
    <text x="345" y="42" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#7AFA56" letter-spacing="0.8">SKILLS</text>

    <!-- Divider 2 -->
    <line x1="460" y1="10" x2="460" y2="42" stroke="#4174F6" stroke-opacity="0.3"/>

    <!-- Stat 3: Projects -->
    <text x="575" y="26" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#F1FBFE">${projectsCount}</text>
    <text x="575" y="42" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#7AFA56" letter-spacing="0.8">PROJECTS</text>
  </g>
</svg>`;
    }

    private async generateIcon(data: WalletCardData): Promise<{ iconPng: Buffer; icon2xPng: Buffer }> {
        const logoPath = this.resolveLogoPath();
        if (logoPath) {
            try {
                const logoBuffer = await sharp(logoPath)
                    .resize(87, 87, { fit: 'cover' })
                    .composite([{
                        input: Buffer.from('<svg><rect width="87" height="87" rx="18" fill="#000"/></svg>'),
                        blend: 'dest-in',
                    }])
                    .png()
                    .toBuffer();
                const iconPng = await sharp(logoBuffer).resize(58, 58).png().toBuffer();
                return { iconPng, icon2xPng: logoBuffer };
            } catch {
                // fallback to SVG below
            }
        }

        const initials = this.initials(data.fullName);
        const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="87" height="87" viewBox="0 0 87 87">
  <defs>
    <linearGradient id="iconBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E1E1E"/>
      <stop offset="50%" stop-color="#0F1D31"/>
      <stop offset="100%" stop-color="#4174F6"/>
    </linearGradient>
  </defs>
  <rect width="87" height="87" rx="18" fill="url(#iconBg)"/>
  <rect x="2" y="2" width="83" height="83" rx="16" fill="none" stroke="#7AFA56" stroke-width="2" stroke-opacity="0.8"/>
  <text x="43.5" y="55" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="700" fill="#F1FBFE">${this.escapeXml(initials)}</text>
</svg>`;
        const icon2xPng = await sharp(Buffer.from(iconSvg)).resize(87, 87).png().toBuffer();
        const iconPng = await sharp(icon2xPng).resize(58, 58).png().toBuffer();
        return { iconPng, icon2xPng };
    }

    private async generateLogo(): Promise<{ logoPng: Buffer; logo2xPng: Buffer }> {
        const logoPath = this.resolveLogoPath();
        let logoMarkB64: string | null = null;
        if (logoPath) {
            try {
                const logoBuffer = await sharp(logoPath)
                    .resize(56, 56, { fit: 'cover' })
                    .composite([{
                        input: Buffer.from('<svg><rect width="56" height="56" rx="12" fill="#000"/></svg>'),
                        blend: 'dest-in',
                    }])
                    .png()
                    .toBuffer();
                logoMarkB64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            } catch {
                logoMarkB64 = null;
            }
        }

        const markSvg = logoMarkB64
            ? `<image href="${logoMarkB64}" x="0" y="12" width="56" height="56"/>`
            : `<g transform="translate(0, 12)">
                 <rect width="56" height="56" rx="12" fill="#1E1E1E" stroke="#4174F6" stroke-width="2"/>
                 <text x="28" y="37" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800" fill="#7AFA56">AW</text>
               </g>`;

        const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="80" viewBox="0 0 280 80">
  ${markSvg}
  <!-- Brand Name in crisp pure white #FFFFFF (just like Google Wallet) -->
  <text x="70" y="50" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="800" fill="#FFFFFF" letter-spacing="1.5">APPLYWIZZ</text>
</svg>`;

        const logo2xPng = await sharp(Buffer.from(logoSvg)).resize(280, 80).png().toBuffer();
        const logoPng = await sharp(logo2xPng).resize(140, 40).png().toBuffer();
        return { logoPng, logo2xPng };
    }

    private resolveLogoPath(): string | null {
        const candidatePaths = [
            path.resolve(process.cwd(), 'src/assets/logo2.jpg'),
            path.resolve(process.cwd(), 'dist/assets/logo2.jpg'),
            path.resolve(process.cwd(), '../logo2.jpg'),
            path.resolve(process.cwd(), 'logo2.jpg'),
            path.resolve(process.cwd(), '../public/logo2.jpg'),
            path.resolve(process.cwd(), 'public/logo2.jpg'),
            '/Users/kodamsai2gmail.com/Desktop/Applywizz Projects/Digital-Resume/backend/src/assets/logo2.jpg',
            '/Users/kodamsai2gmail.com/Desktop/Applywizz Projects/Digital-Resume/logo2.jpg',
        ];
        for (const p of candidatePaths) {
            try {
                if (fs.existsSync(p)) return p;
            } catch {}
        }
        return null;
    }

    private escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    private initials(name?: string | null): string {
        if (!name) return 'AW';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
}

export const applePassAssetsService = new ApplePassAssetsService();
