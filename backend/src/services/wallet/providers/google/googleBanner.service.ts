import sharp from 'sharp';
import type { WalletCardData } from '../../wallet.types.js';

// Exact specifications matching Google Wallet high-res hero image
const BANNER_WIDTH = 1032;
const BANNER_HEIGHT = 640;

export class GoogleBannerService {
    async generateBanner(data: WalletCardData): Promise<Buffer> {
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

        const svg = this.buildSvg(data, avatarBase64);
        return sharp(Buffer.from(svg))
            .resize(BANNER_WIDTH, BANNER_HEIGHT)
            .png({ quality: 98, compressionLevel: 7 })
            .toBuffer();
    }

    private buildSvg(data: WalletCardData, avatarBase64: string | null): string {
        const fullName = this.escapeXml(data.fullName || 'Professional');
        const jobTitle = this.escapeXml(data.jobTitle || data.headline || 'Digital Resume');
        const location = this.escapeXml(data.location || 'Remote');
        const initials = this.initials(data.fullName);
        const isOpenToWork = data.openToWork !== false;

        const expYears = this.escapeXml(`${data.experienceYears || '3'} yrs`);
        const skillsCount = this.escapeXml(`${data.skillsCount || 12}`);
        const projectsCount = this.escapeXml(`${data.projectsCount || 8}`);

        const avatarMarkup = avatarBase64
            ? `<image href="${avatarBase64}" x="75" y="65" width="230" height="230" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
            : `<circle cx="190" cy="180" r="115" fill="url(#monogramGrad)"/>
               <text x="190" y="198" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="76" font-weight="700" fill="#FFFFFF">${this.escapeXml(initials)}</text>`;

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}">
  <defs>
    <!-- PALETTE EXACT 5 COLORS:
         1. Dark Surface: #1E1E1E
         2. Deep Navy:    #0F1D31
         3. Lime/Green:   #7AFA56
         4. Vivid Blue:   #4174F6
         5. Ice White:    #F1FBFE
    -->

    <!-- Main Card Base Gradient: #1E1E1E -> #0F1D31 -->
    <linearGradient id="heroBaseGrad" x1="0%" y1="0%" x2="100%" y2="85%">
      <stop offset="0%" stop-color="#1E1E1E"/>
      <stop offset="40%" stop-color="#0F1D31"/>
      <stop offset="100%" stop-color="#0A1626"/>
    </linearGradient>

    <!-- Top-Right Ribbon Wave 1: Pure #7AFA56 to #4174F6 -->
    <linearGradient id="waveGreenToBlue" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7AFA56"/>
      <stop offset="100%" stop-color="#4174F6"/>
    </linearGradient>

    <!-- Top-Right Ribbon Wave 2: #4174F6 to #7AFA56 with #F1FBFE highlights -->
    <linearGradient id="waveBlueToGreen" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4174F6" stop-opacity="0.95"/>
      <stop offset="60%" stop-color="#7AFA56" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#F1FBFE" stop-opacity="0.8"/>
    </linearGradient>

    <!-- Top-Right Ambient Glow: #4174F6 -->
    <linearGradient id="ambientBlueGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4174F6" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#0F1D31" stop-opacity="0"/>
    </linearGradient>

    <!-- Bottom Wave Contour: #0F1D31 to #4174F6 -->
    <linearGradient id="bottomWaveEdge" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0F1D31"/>
      <stop offset="50%" stop-color="#4174F6" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#0F1D31"/>
    </linearGradient>

    <!-- Bottom-Left Glowing Corner Wave: Pure #7AFA56 fading into #4174F6 and #0F1D31 -->
    <linearGradient id="cornerGreenWave" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7AFA56" stop-opacity="1"/>
      <stop offset="55%" stop-color="#4174F6" stop-opacity="0.75"/>
      <stop offset="90%" stop-color="#0F1D31" stop-opacity="0"/>
    </linearGradient>

    <!-- Avatar monogram gradient: #4174F6 -> #0F1D31 -->
    <linearGradient id="monogramGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4174F6"/>
      <stop offset="100%" stop-color="#0F1D31"/>
    </linearGradient>

    <!-- Circular clip path for avatar -->
    <clipPath id="avatarClip">
      <circle cx="190" cy="180" r="113"/>
    </clipPath>

    <!-- Drop shadow for avatar -->
    <filter id="avatarShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <!-- 1. Background Surface Base (#0F1D31) -->
  <rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="#0F1D31"/>

  <!-- 2. Main Hero Section with smooth curved wave contour -->
  <path d="M 0 0 
           L ${BANNER_WIDTH} 0 
           L ${BANNER_WIDTH} 420 
           C 920 445, 780 435, 620 420 
           C 420 400, 260 410, 140 445 
           C 70 465, 0 455, 0 455 
           Z" 
        fill="url(#heroBaseGrad)"/>

  <!-- Wave Accent: Edge Flow behind curve using #4174F6 -->
  <path d="M 0 425 
           C 70 445, 140 455, 240 435 
           C 420 400, 620 420, ${BANNER_WIDTH} 415 
           L ${BANNER_WIDTH} 435 
           C 780 450, 600 435, 420 420 
           C 240 420, 100 475, 0 475 
           Z" 
        fill="url(#bottomWaveEdge)" opacity="0.85"/>

  <!-- Top-Right Wave: Layer 1 (#4174F6 Ambient Blue Flow) -->
  <path d="M 680 0 
           C 760 95, 870 145, ${BANNER_WIDTH} 125 
           L ${BANNER_WIDTH} 0 
           Z" 
        fill="url(#ambientBlueGlow)"/>

  <!-- Top-Right Wave: Layer 2 (#7AFA56 -> #4174F6 Ribbon) -->
  <path d="M 760 0 
           C 820 80, 910 110, ${BANNER_WIDTH} 85 
           L ${BANNER_WIDTH} 210 
           C 920 220, 830 140, 720 0 
           Z" 
        fill="url(#waveGreenToBlue)"/>

  <!-- Top-Right Wave: Layer 3 (#4174F6 -> #7AFA56 Crisp Accent Ribbon) -->
  <path d="M 830 0 
           C 870 55, 940 85, ${BANNER_WIDTH} 65 
           L ${BANNER_WIDTH} 150 
           C 940 160, 880 100, 800 0 
           Z" 
        fill="url(#waveBlueToGreen)"/>

  <!-- Bottom-Left Glowing Corner Wave (#7AFA56 -> #4174F6) -->
  <path d="M 0 520 
           C 85 545, 155 585, 185 ${BANNER_HEIGHT} 
           L 0 ${BANNER_HEIGHT} 
           Z" 
        fill="url(#cornerGreenWave)"/>

  <!-- 3. Candidate Avatar with Crisp White Ring and Shadow -->
  <g filter="url(#avatarShadow)">
    <circle cx="190" cy="180" r="117.5" fill="none" stroke="#F1FBFE" stroke-width="5"/>
    ${avatarMarkup}
  </g>

  <!-- 4. Candidate Information (Right of Avatar) -->
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif">
    <!-- Full Name (#F1FBFE ice white bold) -->
    <text x="350" y="136" font-size="46" font-weight="800" fill="#F1FBFE" letter-spacing="-0.5">${fullName}</text>

    <!-- Job Title / Profession (#F1FBFE) -->
    <text x="350" y="186" font-size="28" font-weight="600" fill="#F1FBFE" fill-opacity="0.9">${jobTitle}</text>

    <!-- Location Pin & Text -->
    <g transform="translate(350, 214)">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 6 8 15 8 15s8-9 8-15c0-4.42-3.58-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" fill="#4174F6"/>
      <text x="26" y="18" font-size="22" font-weight="400" fill="#F1FBFE" fill-opacity="0.75">${location}</text>
    </g>

    ${isOpenToWork ? `
    <!-- "Open to opportunities" Status (#7AFA56 green dot from palette) -->
    <g transform="translate(350, 258)">
      <circle cx="9" cy="9" r="9" fill="#7AFA56"/>
      <text x="30" y="16" font-size="24" font-weight="600" fill="#7AFA56" letter-spacing="0.2">Open to opportunities</text>
    </g>` : ''}
  </g>

  <!-- 5. 3-Stat Metric Row (Integrated on lower surface) -->
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" transform="translate(0, 500)">
    <!-- Experience (#F1FBFE number, label) -->
    <g transform="translate(190, 0)">
      <text x="0" y="42" text-anchor="middle" font-size="42" font-weight="800" fill="#F1FBFE">${expYears}</text>
      <text x="0" y="78" text-anchor="middle" font-size="24" font-weight="600" fill="#F1FBFE" fill-opacity="0.65">Experience</text>
    </g>

    <!-- Divider 1 (#4174F6 with opacity) -->
    <line x1="360" y1="12" x2="360" y2="88" stroke="#4174F6" stroke-opacity="0.4" stroke-width="2.5"/>

    <!-- Skills -->
    <g transform="translate(516, 0)">
      <text x="0" y="42" text-anchor="middle" font-size="42" font-weight="800" fill="#F1FBFE">${skillsCount}</text>
      <text x="0" y="78" text-anchor="middle" font-size="24" font-weight="600" fill="#F1FBFE" fill-opacity="0.65">Skills</text>
    </g>

    <!-- Divider 2 (#4174F6 with opacity) -->
    <line x1="672" y1="12" x2="672" y2="88" stroke="#4174F6" stroke-opacity="0.4" stroke-width="2.5"/>

    <!-- Projects -->
    <g transform="translate(842, 0)">
      <text x="0" y="42" text-anchor="middle" font-size="42" font-weight="800" fill="#F1FBFE">${projectsCount}</text>
      <text x="0" y="78" text-anchor="middle" font-size="24" font-weight="600" fill="#F1FBFE" fill-opacity="0.65">Projects</text>
    </g>
  </g>
</svg>`;
    }

    private initials(name?: string | null): string {
        if (!name) return 'DR';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

export const googleBannerService = new GoogleBannerService();
