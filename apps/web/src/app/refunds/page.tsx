import { webEnv } from '@/lib/env';
import { PolicySection, SiteShell, SupportEmail } from '@/components/site/site-shell';

export const metadata = { title: 'Refund policy' };

// Draft wording written from how the product works. Have it reviewed before going live.
export default function RefundsPage() {
  const { SUPPORT_EMAIL } = webEnv();
  return (
    <SiteShell title="Refund and cancellation policy" updated="24 September 2026">
      <p>
        Purchases are one-time payments that unlock a single surprise. There is no subscription, so
        there is nothing to cancel.
      </p>
      <PolicySection title="When we refund in full">
        <ul className="list-disc space-y-1 pl-5">
          <li>You were charged but the surprise did not unlock.</li>
          <li>You were charged more than once for the same surprise.</li>
          <li>You have not published the surprise yet and ask within 7 days of paying.</li>
        </ul>
      </PolicySection>
      <PolicySection title="When we usually cannot">
        <p>
          Once a paid surprise has been published and its link opened, the purchase has been used
          and is not normally refundable. We still look at every request, and nothing here limits
          your rights under consumer law.
        </p>
      </PolicySection>
      <PolicySection title="How to ask">
        <p>
          Email <SupportEmail email={SUPPORT_EMAIL} /> with the date of payment and the payment
          reference from your receipt. We reply within 3 working days. Approved refunds go back to
          the original payment method: UPI and card refunds through Razorpay usually arrive within
          5–7 working days; international payments are refunded by Dodo Payments, the seller of
          record, on its own timeline.
        </p>
      </PolicySection>
      <PolicySection title="Surprises we remove">
        <p>If a surprise is taken down for breaking our terms, its purchase is not refunded.</p>
      </PolicySection>
    </SiteShell>
  );
}
