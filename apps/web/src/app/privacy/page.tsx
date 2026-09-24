import { webEnv } from '@/lib/env';
import { PolicySection, SiteShell, SupportEmail } from '@/components/site/site-shell';

export const metadata = { title: 'Privacy policy' };

// Draft wording that describes what the code actually stores (docs/privacy-security.md). Have it
// reviewed before going live, and update it whenever that document changes.
export default function PrivacyPage() {
  const { SUPPORT_EMAIL, OPERATOR_NAME } = webEnv();
  return (
    <SiteShell title="Privacy policy" updated="24 September 2026">
      <p>
        MomentPath is run by {OPERATOR_NAME}. We collect as little as we can: there are no accounts,
        so we never ask for your name, email or phone number to build or open a surprise.
      </p>
      <PolicySection title="What we store">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>What you create:</strong> the text, photos, voice notes, theme and gift details
            of your surprises. Gift codes and puzzle answers are never shown to anyone but you until
            they are earned; gift codes are encrypted.
          </li>
          <li>
            <strong>What recipients answer:</strong> their choices on each step, so the creator can
            see them. Recipients are told on the surprise whether the creator sees individual
            answers.
          </li>
          <li>
            <strong>Access keys:</strong> the secret links that let you manage a surprise and let a
            recipient open it. We keep only scrambled (hashed or encrypted) copies.
          </li>
          <li>
            <strong>Payments:</strong> which surprise was paid for, the amount and the payment
            provider&apos;s reference. We never receive card, bank or UPI details.
          </li>
          <li>
            <strong>Visit counts:</strong> how many times a surprise&apos;s page was opened each
            day, as a number, so its creator can see it arrived. Nothing about the visitor.
          </li>
          <li>
            <strong>PINs:</strong> if a creator sets one, we keep only a scrambled (hashed) copy.
          </li>
          <li>
            <strong>Security records:</strong> an audit log of actions such as publishing, payments
            or takedowns. It never contains messages, answers or gift codes. IP addresses are used
            briefly in memory to limit abuse and are not stored.
          </li>
        </ul>
      </PolicySection>
      <PolicySection title="Cookies">
        <p>
          One functional cookie remembers which surprises this browser created. It is not used for
          advertising or tracking and is not shared with anyone. Clearing it is like losing a key:
          use your saved manage or recovery link to get back in.
        </p>
      </PolicySection>
      <PolicySection title="Who else handles your data">
        <ul className="list-disc space-y-1 pl-5">
          <li>Our hosting provider runs the servers and database.</li>
          <li>Cloudflare R2 stores uploaded photos and voice notes, after a virus scan.</li>
          <li>
            If a surprise includes a YouTube or Vimeo video, that service receives the viewer&apos;s
            address and browser details when the video loads (YouTube through its privacy-enhanced
            mode, Vimeo with do-not-track), under its own privacy policy.
          </li>
          <li>
            Razorpay (India) and Dodo Payments (elsewhere) process payments on their own pages,
            under their own privacy policies. Dodo Payments is the seller of record for
            international purchases.
          </li>
        </ul>
        <p>We do not sell data or use it for advertising.</p>
      </PolicySection>
      <PolicySection title="How long we keep it">
        <p>
          Until you delete the surprise, or delete everything from this browser on the account page.
          Deleting removes the content, photos and answers. Recipients&apos; answers are deleted
          automatically 180 days after they were given. Payment records are kept as long as the law
          requires for accounting, without the surprise&apos;s content.
        </p>
      </PolicySection>
      <PolicySection title="Your rights">
        <p>
          You can delete your surprises yourself at any time. For anything else — a copy of your
          data, a correction, or a question — email <SupportEmail email={SUPPORT_EMAIL} />.
        </p>
      </PolicySection>
    </SiteShell>
  );
}
