import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import { CspNonce } from '@/components/csp-nonce';
import './globals.css';

/** Fraunces (SIL Open Font License, app/fonts/OFL.txt), self-hosted: headings only. */
const fraunces = localFont({
  src: './fonts/fraunces-latin.woff2',
  weight: '500 700',
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Wish Revealer', template: '%s · Wish Revealer' },
  description: 'Build a private, interactive surprise and share it with one link.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fbf6f1',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce');
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="min-h-dvh">
        <CspNonce nonce={nonce} />
        {children}
      </body>
    </html>
  );
}
