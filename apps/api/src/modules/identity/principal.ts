/** The creator or admin for the current request, resolved server-side from a secret token. */
export interface Principal {
  userId: string;
  subject: string;
  isAdmin: boolean;
  /**
   * Set when the request was authorised by a manage link. The credential then grants access to
   * this experience only, so sharing a recovery link cannot reach the owner's other experiences.
   */
  scopeExperienceId?: string;
}

/** Creator credential for every experience this anonymous owner created in one browser. */
export const OWNER_TOKEN_HEADER = 'x-owner-token';
/** Recovery credential for a single experience, carried in its manage link. */
export const MANAGE_TOKEN_HEADER = 'x-manage-token';
/** Operator credential for the moderation endpoints (ADMIN_TOKEN).  */
export const ADMIN_TOKEN_HEADER = 'x-admin-token';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
