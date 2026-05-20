import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const DIRECTORY_CATEGORIES = [
  "Transporter",
  "Contract Manufacturer",
  "Packaging Material",
  "Raw Material",
  "Lab & Testing",
  "Regulatory",
  "Other",
] as const;

export const directory = pgTable("directory", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  category:      text("category").notNull(),
  address:       text("address").notNull().default(""),
  state:         text("state").notNull().default(""),
  country:       text("country").notNull().default(""),
  contact1Name:  text("contact1_name").notNull().default(""),
  contact1Phone: text("contact1_phone").notNull().default(""),
  contact2Name:  text("contact2_name").notNull().default(""),
  contact2Phone: text("contact2_phone").notNull().default(""),
  email1:        text("email1").notNull().default(""),
  email2:        text("email2").notNull().default(""),
  comment:       text("comment").notNull().default(""),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});
