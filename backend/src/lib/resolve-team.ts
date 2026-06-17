import { db } from "../db/client.ts";
import { moduleGrants } from "../db/schema/module-grants.ts";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import type { JWTPayload } from "../modules/auth/jwt.ts";

/**
 * Returns the effective teamId for a request.
 * If ?sharedTeamId=<id> is present, validates that the current user
 * has a grant for the given module from that team, then returns the
 * shared teamId. Returns null if the grant is invalid (caller should 403).
 * If no sharedTeamId param, returns user's own teamId.
 */
export async function resolveTeamId(
  c: Context,
  user: JWTPayload,
  module: string,
): Promise<string | null> {
  const sharedTeamId = c.req.query("sharedTeamId");
  if (!sharedTeamId) return user.teamId;

  const [grant] = await db
    .select()
    .from(moduleGrants)
    .where(
      and(
        eq(moduleGrants.module, module),
        eq(moduleGrants.ownerTeamId, sharedTeamId),
        eq(moduleGrants.granteeUserId, user.sub),
      ),
    )
    .limit(1);

  return grant ? sharedTeamId : null;
}
