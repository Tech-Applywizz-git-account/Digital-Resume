/**
 * Career Identity Theme Registry & Token Engine
 * ------------------------------------------------------------------
 * Defines the three visual design systems for Career Identity:
 * 1. Aurora: Modern Corporate (Clean, confident, blue-accented)
 * 2. Zenith: Professional Glass (Translucent glassmorphism, soft gradient, teal accent)
 * 3. Atlas: Elegant Business (Warm linen neutral, burgundy accent, serif typography)
 */

export type CareerIdentityThemeKey = "aurora" | "zenith" | "atlas";

export type CareerIdentityThemeLayout = "centered" | "sidebar";

export interface CareerIdentityThemeSwatch {
    primary: string;
    accent: string;
    bg: string;
    text: string;
}

export interface CareerIdentityThemeStyles {
    /** Root page background */
    pageBg: string;
    /** Text selection colors */
    selection: string;
    /** Sticky header background */
    headerBg: string;
    /** Header border */
    headerBorder: string;
    /** Header logo icon box */
    logoIconBg: string;
    /** Header logo accent dot/text */
    logoAccentText: string;
    /** Header nav button */
    navButton: string;
    /** Main card surfaces */
    card: string;
    /** Card border */
    cardBorder: string;
    /** Card hover effects */
    cardHover: string;
    /** Section & profile heading typography */
    heading: string;
    /** Subheading & role typography */
    subheading: string;
    /** General body text color */
    bodyText: string;
    /** Accent text color */
    accentText: string;
    /** Accent background for chips & highlights */
    accentBg: string;
    /** Accent border */
    accentBorder: string;
    /** Primary badge / pill (e.g., Verified badge) */
    badge: string;
    /** Secondary pill / chip (e.g., Relocate, Duration) */
    secondaryBadge: string;
    /** Dividers and borders between elements */
    divider: string;
    /** Icon accents in section headers */
    sectionIcon: string;
    /** Sidebar header background */
    sidebarHeaderBg: string;
    /** Sidebar container card */
    sidebarCard: string;
    /** Sidebar border */
    sidebarBorder: string;
    /** Primary dark/high-contrast action CTA */
    buttonPrimary: string;
    /** Secondary border/surface action CTA */
    buttonSecondary: string;
    /** Accent action CTA (e.g., Contact CTA) */
    actionButton: string;
    /** Stat value color (Education, Experience stats) */
    statValue: string;
    /** Highlighted metric text */
    metricText: string;
    /** Experience / education timeline node */
    timelineDot: string;
    /** Skill pill styling */
    skillBadge: string;
    /** Skill pill hover styling */
    skillBadgeHover: string;
}

export interface CareerIdentityThemeDefinition {
    key: CareerIdentityThemeKey;
    name: string;
    badgeLabel: string;
    description: string;
    layout: CareerIdentityThemeLayout;
    swatch: CareerIdentityThemeSwatch;
    styles: CareerIdentityThemeStyles;
}

export const CAREER_IDENTITY_THEMES: CareerIdentityThemeDefinition[] = [
    {
        key: "aurora",
        name: "Aurora",
        badgeLabel: "Corporate",
        description:
            "Clean, confident and blue-accented — a premium profile built for broad, cross-industry recruiter appeal.",
        layout: "centered",
        swatch: {
            primary: "#0e121b",
            accent: "#2563eb",
            bg: "#f8fafc",
            text: "#0f172a",
        },
        styles: {
            pageBg: "bg-[#f8fafc]",
            selection: "selection:bg-blue-100 selection:text-blue-900",
            headerBg: "bg-white/95 backdrop-blur-md",
            headerBorder: "border-slate-200",
            logoIconBg: "bg-blue-600 shadow-blue-200 text-white",
            logoAccentText: "text-blue-600",
            navButton:
                "bg-slate-50 border-slate-100 text-[#0e121b] hover:bg-blue-600 hover:text-white hover:border-blue-600",
            card: "bg-white rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-100/70 border border-slate-100",
            cardBorder: "border-slate-200",
            cardHover:
                "hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-50/50",
            heading: "font-sans font-black tracking-tight text-[#0e121b]",
            subheading: "font-sans font-bold text-blue-600",
            bodyText: "text-slate-700",
            accentText: "text-blue-600",
            accentBg: "bg-blue-600 text-white",
            accentBorder: "border-blue-200",
            badge: "bg-blue-600 text-white shadow-blue-100 font-bold",
            secondaryBadge: "bg-slate-100 text-slate-500 border-slate-200 font-medium",
            divider: "border-slate-100",
            sectionIcon: "text-blue-600",
            sidebarHeaderBg: "bg-[#0e121b] text-white",
            sidebarCard: "bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden",
            sidebarBorder: "border-slate-200",
            buttonPrimary:
                "bg-[#0e121b] text-white hover:bg-blue-600 shadow-slate-200",
            buttonSecondary:
                "bg-white border-slate-200 text-[#0e121b] hover:bg-slate-50 shadow-slate-50",
            actionButton:
                "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200",
            statValue: "text-[#0e121b] font-bold",
            metricText: "text-blue-600 font-bold",
            timelineDot: "bg-blue-600 text-white shadow-lg shadow-blue-200",
            skillBadge:
                "bg-white text-slate-700 border-slate-200 shadow-sm",
            skillBadgeHover:
                "hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700",
        },
    },
    {
        key: "zenith",
        name: "Zenith",
        badgeLabel: "Glass",
        description:
            "Soft gradient backdrop with translucent, blurred cards and a teal accent — a modern, design-forward premium profile.",
        layout: "centered",
        swatch: {
            primary: "#1a2d33",
            accent: "#2a7b6f",
            bg: "#f0fdfa",
            text: "#134e4a",
        },
        styles: {
            pageBg: "bg-gradient-to-br from-[#f0fdfa] via-[#f8fafc] to-[#e6fffa]",
            selection: "selection:bg-teal-100 selection:text-teal-900",
            headerBg: "bg-white/80 backdrop-blur-xl",
            headerBorder: "border-teal-100/70",
            logoIconBg: "bg-[#2a7b6f] text-white shadow-teal-200/50",
            logoAccentText: "text-[#2a7b6f]",
            navButton:
                "bg-white/70 backdrop-blur-md border-teal-100 text-teal-900 hover:bg-[#2a7b6f] hover:text-white hover:border-[#2a7b6f]",
            card: "bg-white rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-teal-950/5 border border-slate-100/80",
            cardBorder: "border-slate-100/80",
            cardHover:
                "hover:shadow-2xl hover:shadow-teal-900/5",
            heading: "font-sans font-black tracking-tight text-slate-900",
            subheading: "font-sans font-bold text-[#2a7b6f]",
            bodyText: "text-slate-600",
            accentText: "text-[#2a7b6f]",
            accentBg: "bg-[#2a7b6f] text-white",
            accentBorder: "border-teal-200",
            badge: "bg-[#2a7b6f] text-white shadow-teal-100 font-bold",
            secondaryBadge: "bg-teal-50 text-[#2a7b6f] border-teal-100 font-medium",
            divider: "border-teal-100/60",
            sectionIcon: "text-[#2a7b6f]",
            sidebarHeaderBg: "bg-[#1a2d33] text-white",
            sidebarCard: "bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-teal-950/5 overflow-hidden",
            sidebarBorder: "border-slate-200/80",
            buttonPrimary:
                "bg-[#22393d] text-white hover:bg-[#1a2d33] shadow-slate-200",
            buttonSecondary:
                "bg-white border border-teal-100 text-[#2a7b6f] hover:bg-teal-50/50 shadow-sm",
            actionButton:
                "bg-[#3f8b80] text-white hover:bg-[#34746d] shadow-lg shadow-teal-900/10",
            statValue: "text-slate-900 font-bold",
            metricText: "text-[#2a7b6f] font-bold",
            timelineDot: "bg-[#2a7b6f] text-white shadow-lg shadow-teal-300/50",
            skillBadge:
                "bg-white text-slate-700 border-teal-200/80 shadow-sm",
            skillBadgeHover:
                "hover:border-teal-400 hover:bg-teal-50/50 hover:text-teal-800",
        },
    },
    {
        key: "atlas",
        name: "Atlas",
        badgeLabel: "Serif",
        description:
            "Warm neutral palette, burgundy accent and serif headings — an elegant business profile with classic appeal.",
        layout: "centered",
        swatch: {
            primary: "#2a181b",
            accent: "#881337",
            bg: "#faf8f5",
            text: "#292524",
        },
        styles: {
            pageBg: "bg-[#faf8f5]",
            selection: "selection:bg-rose-100 selection:text-rose-950",
            headerBg: "bg-[#faf8f5]/95 backdrop-blur-md",
            headerBorder: "border-[#e8e2d5]",
            logoIconBg: "bg-[#881337] shadow-rose-900/20 text-[#faf8f5]",
            logoAccentText: "text-[#881337]",
            navButton:
                "bg-[#f4efe6] border-[#dfd7ca] text-[#2a181b] hover:bg-[#881337] hover:text-[#faf8f5] hover:border-[#881337]",
            card: "bg-[#ffffff] rounded-[2rem] p-6 md:p-8 shadow-md shadow-stone-200/50 border border-[#e7e1d5]",
            cardBorder: "border-[#e8e2d5]",
            cardHover:
                "hover:border-[#c9bfb0] hover:shadow-xl hover:shadow-stone-300/40",
            heading: "font-serif font-bold tracking-normal text-[#1c1917]",
            subheading: "font-serif font-medium italic text-[#881337]",
            bodyText: "text-stone-700",
            accentText: "text-[#881337]",
            accentBg: "bg-[#881337] text-white",
            accentBorder: "border-rose-200",
            badge: "bg-[#881337] text-white shadow-rose-950/20 font-bold",
            secondaryBadge: "bg-[#f4efe6] text-stone-700 border-[#e3dcd1] font-medium",
            divider: "border-[#eee8dc]",
            sectionIcon: "text-[#881337]",
            sidebarHeaderBg: "bg-[#2a181b] text-[#faf8f5]",
            sidebarCard: "bg-[#ffffff] rounded-2xl border border-[#e8e2d5] shadow-lg shadow-stone-200/60 overflow-hidden",
            sidebarBorder: "border-[#e8e2d5]",
            buttonPrimary:
                "bg-[#881337] text-white hover:bg-[#701a28] shadow-md shadow-rose-950/20",
            buttonSecondary:
                "bg-[#faf8f5] border-[#dfd7ca] text-[#2a181b] hover:bg-[#f0ebe1] shadow-stone-100",
            actionButton:
                "bg-[#881337] text-white hover:bg-[#701a28] shadow-rose-900/30",
            statValue: "text-[#1c1917] font-serif font-bold",
            metricText: "text-[#881337] font-serif font-bold",
            timelineDot: "bg-[#881337] text-white shadow-lg shadow-rose-900/30",
            skillBadge:
                "bg-[#ffffff] text-stone-800 border-[#e3dcd1] shadow-sm",
            skillBadgeHover:
                "hover:border-[#881337] hover:bg-rose-50 hover:text-[#881337]",
        },
    },
];

export const DEFAULT_CAREER_IDENTITY_THEME: CareerIdentityThemeKey = "aurora";

export const getThemeDefinition = (
    key: string | null | undefined
): CareerIdentityThemeDefinition => {
    return (
        CAREER_IDENTITY_THEMES.find((t) => t.key === key) ||
        getFallbackTheme()
    );
};

export const getThemeTokens = (
    key: string | null | undefined
): CareerIdentityThemeStyles => {
    return getThemeDefinition(key).styles;
};

const getFallbackTheme = (): CareerIdentityThemeDefinition =>
    CAREER_IDENTITY_THEMES.find((t) => t.key === DEFAULT_CAREER_IDENTITY_THEME) ||
    CAREER_IDENTITY_THEMES[0];

export interface CareerIdentityModalThemeStyles {
    /** Header background style */
    headerBg: string;
    /** Header text / subtitle style */
    headerSubtitle: string;
    /** Header font class */
    headerFont: string;
    /** Modal card outer container */
    cardContainer: string;
    /** Info card surface and hover */
    infoCard: string;
    /** Icon container pill inside info card */
    iconPill: string;
    /** Text/label styles */
    labelFont: string;
    valueFont: string;
    /** Primary Action CTA (e.g. Email Candidate, Download Resume) */
    primaryButton: string;
    /** Secondary Action CTA (e.g. WhatsApp Candidate, Schedule Call) */
    secondaryButton: string;
    /** Avatar selection styling */
    avatarActiveGender: string;
    avatarHoverBorder: string;
    /** Share modal styles */
    shareHeaderBg: string;
    shareHeaderSubtitle: string;
    shareOptionCard: string;
    shareOptionIcon: string;
    shareActionButton: string;
}

export const getModalThemeTokens = (
    key: string | null | undefined
): CareerIdentityModalThemeStyles => {
    switch (key) {
        case 'atlas':
            return {
                headerBg: 'bg-[#881337] text-white',
                headerSubtitle: 'text-rose-200',
                headerFont: 'font-serif font-bold',
                cardContainer: 'bg-white rounded-3xl shadow-2xl border border-[#e8e2d5]',
                infoCard: 'bg-[#faf8f5] border-[#e8e2d5] hover:border-[#881337]/40',
                iconPill: 'bg-rose-50 text-[#881337]',
                labelFont: 'text-stone-400 font-serif',
                valueFont: 'text-[#1c1917] font-serif',
                primaryButton: 'bg-[#881337] text-white hover:bg-[#701a28] shadow-rose-950/20 font-serif',
                secondaryButton: 'bg-white border-[#881337] text-[#881337] hover:bg-rose-50 font-serif',
                avatarActiveGender: 'bg-white text-[#881337]',
                avatarHoverBorder: 'hover:border-[#881337]',
                shareHeaderBg: 'bg-[#2a181b] text-[#faf8f5]',
                shareHeaderSubtitle: 'text-rose-200 font-serif',
                shareOptionCard: 'border-[#e8e2d5] hover:border-rose-300 hover:bg-rose-50/50',
                shareOptionIcon: 'bg-rose-50 text-[#881337] group-hover:bg-rose-100',
                shareActionButton: 'bg-[#2a181b] text-white hover:bg-[#881337]',
            };
        case 'zenith':
            return {
                headerBg: 'bg-[#2a7b6f] text-white',
                headerSubtitle: 'text-teal-100',
                headerFont: 'font-sans font-bold',
                cardContainer: 'bg-white rounded-3xl shadow-2xl border border-teal-100/80',
                infoCard: 'bg-teal-50/30 border-teal-100/70 hover:border-teal-300',
                iconPill: 'bg-teal-50 text-[#2a7b6f]',
                labelFont: 'text-slate-400 font-sans',
                valueFont: 'text-slate-900 font-sans',
                primaryButton: 'bg-[#2a7b6f] text-white hover:bg-[#23685e] shadow-teal-900/20 font-sans',
                secondaryButton: 'bg-white border-teal-600 text-[#2a7b6f] hover:bg-teal-50 font-sans',
                avatarActiveGender: 'bg-white text-[#2a7b6f]',
                avatarHoverBorder: 'hover:border-[#2a7b6f]',
                shareHeaderBg: 'bg-[#1a2d33] text-white',
                shareHeaderSubtitle: 'text-teal-200',
                shareOptionCard: 'border-teal-100/80 hover:border-teal-300 hover:bg-teal-50/50',
                shareOptionIcon: 'bg-teal-50 text-[#2a7b6f] group-hover:bg-teal-100',
                shareActionButton: 'bg-[#1a2d33] text-white hover:bg-[#2a7b6f]',
            };
        case 'aurora':
        default:
            return {
                headerBg: 'bg-blue-600 text-white',
                headerSubtitle: 'text-blue-100',
                headerFont: 'font-sans font-bold',
                cardContainer: 'bg-white rounded-3xl shadow-2xl border border-slate-100',
                infoCard: 'bg-slate-50 border-slate-100 hover:border-blue-200',
                iconPill: 'bg-blue-50 text-blue-600',
                labelFont: 'text-slate-400 font-sans',
                valueFont: 'text-[#0e121b] font-sans',
                primaryButton: 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 font-sans',
                secondaryButton: 'bg-white border-blue-500 text-blue-600 hover:bg-blue-50 font-sans',
                avatarActiveGender: 'bg-white text-blue-600',
                avatarHoverBorder: 'hover:border-blue-500',
                shareHeaderBg: 'bg-[#0e121b] text-white',
                shareHeaderSubtitle: 'text-blue-200',
                shareOptionCard: 'border-slate-100 hover:border-blue-200 hover:bg-blue-50/50',
                shareOptionIcon: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
                shareActionButton: 'bg-[#0e121b] text-white hover:bg-blue-600',
            };
    }
};