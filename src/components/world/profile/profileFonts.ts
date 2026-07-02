import { Playfair_Display, Cormorant_Garamond, Nunito, Great_Vibes } from 'next/font/google';

export const playfair = Playfair_Display({
    subsets: ['latin'],
    weight: ['600', '700', '800', '900'],
    variable: '--profile-serif',
    display: 'swap',
});

export const cormorant = Cormorant_Garamond({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--profile-softserif',
    display: 'swap',
});

export const nunito = Nunito({
    subsets: ['latin'],
    weight: ['300', '400', '600', '700', '800'],
    variable: '--profile-sans',
    display: 'swap',
});

// Signature script for the character's name (Google-Fonts stand-in for the
// pen's "Brittany Signature", which isn't on Google Fonts).
export const greatVibes = Great_Vibes({
    subsets: ['latin'],
    weight: ['400'],
    variable: '--profile-script',
    display: 'swap',
});
