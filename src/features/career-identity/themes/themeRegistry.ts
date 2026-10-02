/**
 * Career Identity Theme Registry
 * ------------------------------------------------------------------
 * Three premium themes: Modern Corporate, Elegant Business, Professional Glass.
 */

export type CareerIdentityThemeKey = "aurora" | "zenith" | "atlas";

export type CareerIdentityThemeLayout = "centered" | "sidebar";

export interface CareerIdentityThemeDefinition {
    key: CareerIdentityThemeKey;
    name: string;
    description: string;
    layout: CareerIdentityThemeLayout;
}

export const CAREER_IDENTITY_THEMES: CareerIdentityThemeDefinition[] = [
    {
        key: "aurora",
        name: "Modern Corporate",
        description:
            "Clean, confident and blue-accented — a premium profile built for broad, cross-industry recruiter appeal.",
        layout: "centered",
    },
    {
        key: "zenith",
        name: "Professional Glass",
        description:
            "Soft gradient backdrop with translucent, blurred cards and a teal accent — a modern, design-forward premium profile.",
        layout: "centered",
    },
    {
        key: "atlas",
        name: "Elegant Business",
        description:
            "Warm neutral palette, burgundy accent and serif headings — an elegant business profile with classic appeal.",
        layout: "centered",
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

const getFallbackTheme = (): CareerIdentityThemeDefinition =>
    CAREER_IDENTITY_THEMES.find((t) => t.key === DEFAULT_CAREER_IDENTITY_THEME) ||
    CAREER_IDENTITY_THEMES[0];