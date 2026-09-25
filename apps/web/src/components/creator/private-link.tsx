'use client';

import { useState } from 'react';
import { Button } from '@momentpath/design-system';
import { detailsFileName, detailsText, type SurpriseLinks } from '@/lib/surprise-details';

export { PRIVATE_LINK_WARNING, type SurpriseLinks } from '@/lib/surprise-details';

export function downloadDetails(links: SurpriseLinks) {
  const blob = new Blob([detailsText(links)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = detailsFileName(links.title);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copy · Bookmark · Download Details for the private management link. Bookmark opens the phone's
 * share sheet (save to notes, send to yourself) where there is one, and otherwise offers the
 * link to drag to the bookmarks bar — the page you are on is not the link to keep.
 */
export function PrivateLinkActions({
  links,
  onSaved,
  withCopy = true,
}: {
  links: SurpriseLinks;
  /** Off where the page already has its own big "Copy Private Link" button. */
  withCopy?: boolean;
  /** Called after any of the saving actions, so a page can note that it was saved. */
  onSaved?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [bookmarkHelp, setBookmarkHelp] = useState(false);

  async function bookmark() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Manage: ${links.title || 'my surprise'} (private)`,
          url: links.manageUrl,
        });
        onSaved?.();
        return;
      } catch {
        /* dismissed: offer the other way */
      }
    }
    setBookmarkHelp(true);
  }

  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${withCopy ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {withCopy ? (
          <Button
            variant="secondary"
            className="flex-col gap-0.5 py-2 text-xs sm:flex-row sm:gap-2 sm:text-sm"
            data-testid="copy-private-link"
            onClick={async () => {
              await navigator.clipboard.writeText(links.manageUrl);
              setCopied(true);
              onSaved?.();
            }}
          >
            <span aria-hidden="true" className="text-lg sm:text-base">
              {copied ? '✅' : '📋'}
            </span>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          className="flex-col gap-0.5 py-2 text-xs sm:flex-row sm:gap-2 sm:text-sm"
          onClick={bookmark}
          data-testid="bookmark-private-link"
        >
          <span aria-hidden="true" className="text-lg sm:text-base">
            ⭐
          </span>
          Bookmark
        </Button>
        <Button
          variant="secondary"
          className="flex-col gap-0.5 py-2 text-xs sm:flex-row sm:gap-2 sm:text-sm"
          data-testid="download-details"
          onClick={() => {
            downloadDetails(links);
            setDownloaded(true);
            onSaved?.();
          }}
        >
          <span aria-hidden="true" className="text-lg sm:text-base">
            {downloaded ? '✅' : '⬇️'}
          </span>
          {downloaded ? 'Saved' : 'Download'}
        </Button>
      </div>
      {bookmarkHelp ? (
        <div className="rounded-2xl bg-ink-50 p-3 text-sm text-ink-700" role="status">
          <p>Drag this to your bookmarks bar, or open it and press Ctrl+D (⌘D on a Mac):</p>
          <a
            href={links.manageUrl}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 font-medium text-brand-700 shadow-sm ring-1 ring-ink-200"
            onClick={(e) => e.preventDefault()}
            onDragEnd={() => onSaved?.()}
          >
            ⭐ Manage: {links.title || 'my surprise'}
          </a>
        </div>
      ) : null}
    </div>
  );
}
