import './globals.css';
import type { Metadata, Viewport } from 'next';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'ORACLE v2 · Trading Intelligence',
  description:
    'Operational Reconnaissance & Analytical Crypto Logic Engine — SMC + VWAP + Anchored Volume Profile signal engine and decision-support for crypto trading.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'ORACLE · Market Intelligence',
    description: 'Operational Reconnaissance & Analytical Crypto Logic Engine',
    images: [{ url: '/icon.svg', width: 64, height: 64, type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0c12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
