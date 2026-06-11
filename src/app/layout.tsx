import type { Metadata } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const merriweather = Merriweather({ subsets: ['latin'], weight: ['300', '400', '700'], variable: '--font-serif' });

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
      <body className={`${inter.variable} ${merriweather.variable}`}>
        <SupabaseSyncProvider>
          {children}
        </SupabaseSyncProvider>
      </body>
    </html>
  );
}
