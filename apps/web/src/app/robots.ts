import type { MetadataRoute } from 'next';

/** Recipient links and the BFF are never crawled; there is intentionally no sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/e/', '/bff/', '/dashboard', '/experiences', '/admin', '/account', '/new'],
      },
    ],
  };
}
