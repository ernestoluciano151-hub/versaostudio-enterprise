import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Versão Digital · Agência de Marketing em Luanda, Angola',
    template: '%s · Versão Digital',
  },
  description:
    'Marketing 360°, audiovisual, identidade visual e presença online em Luanda, Angola.',
  metadataBase: new URL('https://www.versaodigitallda.com'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#B8862A',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-AO">
      <body>{children}</body>
    </html>
  );
}
