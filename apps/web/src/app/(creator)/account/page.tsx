import { cookies } from 'next/headers';
import { Card } from '@momentpath/design-system';
import { DeleteAccount } from '@/components/creator/delete-account';
import { PasskeysPanel } from '@/components/creator/passkeys';
import { RecoveryLink } from '@/components/creator/recovery-link';
import { readOwnerToken } from '@/lib/auth/owner';
import { webEnv } from '@/lib/env';

export const metadata = { title: 'Account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  // The owner token is HttpOnly, so only the server can read it back out to show the link.
  const token = readOwnerToken(await cookies());
  const recoveryUrl = token ? `${webEnv().WEB_ORIGIN}/r/${token}` : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold">Account</h1>

      <Card>
        <h2 className="text-base font-medium">You don’t have an account</h2>
        <p className="mt-2 text-sm text-ink-600">
          Nothing here is tied to a name, an email address or a password. This browser holds a
          private key to the surprises you have made.
        </p>
      </Card>

      {recoveryUrl ? (
        <Card>
          <h2 className="text-base font-medium">Passkey — the easy way back</h2>
          <p className="mt-2 text-sm text-ink-600">
            Save a passkey and you can get back to your surprises on any device with Face ID, Touch
            ID or your screen lock — no password, no email. It is kept by your phone or computer
            (and synced by iCloud Keychain or Google Password Manager); we only store a public key
            that is useless to anyone else.
          </p>
          <div className="mt-4">
            <PasskeysPanel />
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-base font-medium">Getting back in</h2>
        <p className="mt-2 text-sm text-ink-600">
          If you clear your browser data, use a different device, or switch browsers, this link is
          how you get back to everything you have made. Without it there is no way to recover your
          surprises — not even for us, because nothing identifies you.
        </p>
        <div className="mt-4">
          {recoveryUrl ? (
            <RecoveryLink url={recoveryUrl} />
          ) : (
            <p className="text-sm text-ink-500">
              You are viewing a single surprise through its manage link, so there is no account-wide
              recovery link to show.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-medium">This device</h2>
        <p className="mt-2 text-sm text-ink-600">
          Clearing this browser removes your key from it. Make sure you have saved the recovery link
          above first.
        </p>
        <form action="/forget" method="post" className="mt-4">
          <button
            type="submit"
            className="min-h-11 rounded-xl px-4 text-sm font-medium ring-1 ring-ink-200 hover:bg-ink-50"
          >
            Forget me on this device
          </button>
        </form>
      </Card>

      <DeleteAccount />
    </main>
  );
}
