import { db } from "../../db/client.ts";
import { users } from "../../db/schema/users.ts";
import { teams } from "../../db/schema/teams.ts";
import { eq } from "drizzle-orm";

export const getAllUsers = () =>
  db
    .select({
      id:         users.id,
      name:       users.name,
      email:      users.email,
      role:       users.role,
      status:     users.status,
      department: users.department,
      teamId:     users.teamId,
      createdAt:  users.createdAt,
    })
    .from(users)
    .orderBy(users.name);

export const getPendingUsers = () =>
  db
    .select({
      id:         users.id,
      name:       users.name,
      email:      users.email,
      role:       users.role,
      status:     users.status,
      department: users.department,
      teamId:     users.teamId,
      createdAt:  users.createdAt,
    })
    .from(users)
    .where(eq(users.status, "Pending"))
    .orderBy(users.createdAt);

export const getAllTeams = () =>
  db.select().from(teams).orderBy(teams.name);
