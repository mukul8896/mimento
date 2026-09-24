import Link from 'next/link';
import { PasskeySignIn } from '@/components/creator/passkeys';
import { SiteShell } from '@/components/site/site-shell';

export const metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <SiteShell title="Get back to your surprises">
      <p>
        There is no account or password. If you saved a passkey, confirm with Face ID, Touch ID or
        your screen lock and everything you made opens here — including on a new phone, as long as
        your passkeys sync (iCloud Keychain, Google Password Manager).
      </p>
      <PasskeySignIn />
      <p className="text-sm text-ink-500">
        No passkey? Open the recovery link you saved from your Account page, or a surprise’s manage
        link. Anything you start here before signing in is kept.
      </p>
      <p className="text-sm">
        <Link href="/new" className="font-medium text-brand-700 underline">
          Start a new surprise instead
        </Link>
      </p>
    </SiteShell>
  );
}
