export interface LandingThemeMeta {
    id: string;
    name: string;
    tagline: string;
}

export const THEME_STORAGE_KEY = 'lc-landing-theme';
export const DEFAULT_THEME_ID = 'fantasy';

export const LANDING_THEMES: LandingThemeMeta[] = [
    {
        id: 'fantasy',
        name: 'Fantasy Storybook',
        tagline: "The Cartographer's Desk",
    },
];

export function getTheme(id: string | null): LandingThemeMeta {
    return (
        LANDING_THEMES.find((t) => t.id === id) ??
        LANDING_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!
    );
}
