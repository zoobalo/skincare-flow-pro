import { db } from "../db/client.ts";
import { userGrants } from "../db/schema/user-grants.ts";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import type { JWTPayload } from "../modules/auth/jwt.ts";

/** Resolves the owner user ID for a personal module request.
 *  - No sharedUserId param → own data (user.sub)
 *  - sharedUserId === own id → own data
 *  - sharedUserId provided → look up user_grants; return it if granted, null if not
 */
export async function resolveOwnerId(
  c: Context,
  user: JWTPayload,
  module: string,
): Promise<string | null> {
  const sharedUserId = c.req.query("sharedUserId");
  if (!sharedUserId) return user.sub;
  if (sharedUserId === user.sub) return user.sub;
  const [grant] = await db.select().from(userGrants).where(
    and(
      eq(userGrants.module, module),
      eq(userGrants.ownerUserId, sharedUserId),
      eq(userGrants.granteeUserId, user.sub),
    )
  ).limit(1);
  return grant ? sharedUserId : null;
}
