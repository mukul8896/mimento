import path from 'node:path';

/**
 * There are no accounts. Each "user" is just a browser profile holding its own anonymous owner
 * cookie; `admin` holds the operator credential instead.
 */
export const USERS = {
  alice: { operator: false },
  bob: { operator: false },
  admin: { operator: true },
} as const;

export type UserName = keyof typeof USERS;

export const OPERATOR_TOKEN =
  process.env.ADMIN_TOKEN ?? 'dev-only-admin-token-change-me-0123456789';

export const authFile = (user: UserName) => path.join(__dirname, '.auth', `${user}.json`);
