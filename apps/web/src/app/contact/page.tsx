import Link from 'next/link';
import { webEnv } from '@/lib/env';
import { PolicySection, SiteShell, SupportEmail } from '@/components/site/site-shell';

export const metadata = { title: 'Contact' };

export default function ContactPage() {
  const { SUPPORT_EMAIL, OPERATOR_NAME } = webEnv();
  return (
    <SiteShell title="Contact us">
      <p>
        Wish Revealer is run by {OPERATOR_NAME}. For help with a payment, a refund, a surprise you
        made or anything else, email <SupportEmail email={SUPPORT_EMAIL} />. We reply within 3
        working days.
      </p>
      <PolicySection title="Reporting a surprise">
        <p>
          If you received a surprise that is abusive or illegal, use the <strong>Report</strong>{' '}
          option on it. That reaches our moderation team directly and does not need an email.
        </p>
      </PolicySection>
      <PolicySection title="Lost access to a surprise you made">
        <p>
          We cannot look you up — there are no accounts. Open the manage link or recovery link you
          saved; see the{' '}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>{' '}
          for why.
        </p>
      </PolicySection>
    </SiteShell>
  );
}
