import Link from 'next/link';
import { webEnv } from '@/lib/env';
import { PolicySection, SiteShell, SupportEmail } from '@/components/site/site-shell';

export const metadata = { title: 'Terms of service' };

// Draft wording written from how the product works. Have it reviewed before going live.
export default function TermsPage() {
  const { SUPPORT_EMAIL, OPERATOR_NAME } = webEnv();
  return (
    <SiteShell title="Terms of service" updated="24 September 2026">
      <p>
        These terms apply when you create or open a surprise on Wish Revealer, a service run by{' '}
        {OPERATOR_NAME}. By using it you agree to them.
      </p>
      <PolicySection title="The service">
        <p>
          Wish Revealer lets you build an interactive surprise and share it with a private link. You
          do not need an account. When you publish, you get a recipient link to share and a private
          management link for you. Keep the private link safe: WishRevealer does not require an
          account, so this private link is how you access and manage your surprise. We may not be
          able to restore access if you lose it.
        </p>
      </PolicySection>
      <PolicySection title="What you may not create">
        <ul className="list-disc space-y-1 pl-5">
          <li>Anything illegal, or that harasses, threatens or impersonates someone.</li>
          <li>Sexual content involving minors, or intimate images shared without consent.</li>
          <li>Malware, phishing, or requests for passwords or payment details.</li>
          <li>Content you do not have the right to share.</li>
        </ul>
        <p>
          We may take down a surprise that breaks these rules, and we act on reports. You are
          responsible for what you put in your surprises.
        </p>
      </PolicySection>
      <PolicySection title="Links and privacy">
        <p>
          Anyone with a surprise&apos;s link can open it. Recipients can forward links and take
          screenshots, and we cannot stop that. Gift codes are revealed only after the steps you
          chose, but once revealed, they are in the recipient&apos;s hands.
        </p>
      </PolicySection>
      <PolicySection title="Payments">
        <p>
          Some templates and custom builds need a one-time payment before you can share them. Prices
          are shown before you pay, on the{' '}
          <Link href="/pricing" className="underline">
            pricing page
          </Link>{' '}
          and at checkout. Payments are processed by Razorpay or Dodo Payments; for customers
          outside India, Dodo Payments is the seller of record and its terms also apply. Refunds
          follow our{' '}
          <Link href="/refunds" className="underline">
            refund policy
          </Link>
          .
        </p>
      </PolicySection>
      <PolicySection title="Availability and liability">
        <p>
          We work to keep Wish Revealer running and your content safe, but the service is provided
          as it is, without guarantees that it will always be available or error-free. To the extent
          the law allows, our liability for any claim is limited to what you paid us for the
          surprise concerned.
        </p>
      </PolicySection>
      <PolicySection title="Changes and contact">
        <p>
          We may update these terms; the date above shows the latest version. Questions:{' '}
          <SupportEmail email={SUPPORT_EMAIL} />.
        </p>
      </PolicySection>
    </SiteShell>
  );
}
