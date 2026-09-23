import type { PrismaService, Tx } from '../prisma/prisma.service';
import type { Principal } from '../modules/identity/principal';
import { Problem } from './problem';

/**
 * Object-level authorization for creator routes. The owner id always comes from the verified
 * principal. A foreign or deleted experience yields 404 rather than 403 so that ids of other
 * users' resources cannot be probed.
 */
export async function requireOwnedExperience(
  prisma: PrismaService | Tx,
  principal: Principal,
  experienceId: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(experienceId)) throw Problem.notFound('Experience');
  // A manage link authorises exactly one experience; anything else is invisible to it.
  if (principal.scopeExperienceId && principal.scopeExperienceId !== experienceId)
    throw Problem.notFound('Experience');
  const experience = await prisma.experience.findFirst({
    where: { id: experienceId, ownerId: principal.userId, status: { not: 'DELETED' } },
  });
  if (!experience) throw Problem.notFound('Experience');
  return experience;
}
