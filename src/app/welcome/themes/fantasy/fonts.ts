import { IM_Fell_English, EB_Garamond } from 'next/font/google';

export const imFell = IM_Fell_English({
    weight: '400',
    style: ['normal', 'italic'],
    subsets: ['latin'],
    variable: '--font-fell',
});

export const ebGaramond = EB_Garamond({
    weight: ['400', '500', '600'],
    style: ['normal', 'italic'],
    subsets: ['latin'],
    variable: '--font-garamond',
});
