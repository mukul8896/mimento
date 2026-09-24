/**
 * Opens WhatsApp with the private link and a friendly line, ready to send. Uses the public
 * wa.me link (free, no API): nothing is sent until the creator presses send in WhatsApp.
 */
export function WhatsAppShare({ link, className = '' }: { link: string; className?: string }) {
  const text = `I made something for you 🎁 Open it here: ${link}`;
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1f7a4d] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#186540] ${className}`}
      data-testid="whatsapp-share"
    >
      <span aria-hidden="true">💬</span> Share on WhatsApp
    </a>
  );
}
