import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { CspNonce } from '@/components/csp-nonce';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Wish Revealer', template: '%s · Wish Revealer' },
  description: 'Build a private, interactive surprise and share it with one link.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#c81e55',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce');
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <CspNonce nonce={nonce} />
        {children}
      </body>
    </html>
  );
}
