import { NextResponse } from 'next/server';
import { webEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Former creator-wide recovery links. Each surprise now has its own private management link
 * (/m/<token>) and there is no collection of surprises to recover, so these open the home page
 * and set nothing (owner decision, 25 Sep 2026).
 */
export function GET() {
  return NextResponse.redirect(new URL('/', webEnv().WEB_ORIGIN));
}
