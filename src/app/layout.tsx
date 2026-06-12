import type { Metadata } from "next";
import { Inter, Merriweather, IM_Fell_English, EB_Garamond } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const merriweather = Merriweather({ subsets: ['latin'], weight: ['300', '400', '700'], variable: '--font-serif' });

// Fantasy theme display + body serifs (used app-wide when the fantasy theme
// family is active; see globals.css [data-theme-family="fantasy"]).
const imFell = IM_Fell_English({ weight: '400', style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-fell' });
const ebGaramond = EB_Garamond({ weight: ['400', '500', '600'], style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-garamond' });

export const metadata: Metadata = {
  title: "LoreCanvas",
  description: "Creation happens at the point of inspiration. The tool never pulls the writer out of their flow.",
};

import { SupabaseSyncProvider } from "@/components/providers/SupabaseSyncProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${merriweather.variable} ${imFell.variable} ${ebGaramond.variable}`}>
        <SupabaseSyncProvider>
          {children}
        </SupabaseSyncProvider>
      </body>
    </html>
  );
}
