import { db } from "../../db/client.ts";
import { users } from "../../db/schema/users.ts";

export const getAllUsers = () =>
  db
    .select({
      id:        users.id,
      name:      users.name,
      email:     users.email,
      role:      users.role,
      status:    users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.name);
