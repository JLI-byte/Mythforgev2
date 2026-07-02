import { Playfair_Display, Cormorant_Garamond, Nunito } from 'next/font/google';

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
