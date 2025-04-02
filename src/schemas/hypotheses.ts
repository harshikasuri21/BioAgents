import {
  pgTable,
  pgSchema,
  uuid,
  text,
  timestamp,
  numeric,
  pgEnum,
  primaryKey,
} from "drizzle-orm/pg-core";

export const biographSchema = pgSchema("biograph");

export const hypothesisStatusEnum = pgEnum("hypothesis_status", [
  "pending",
  "approved",
  "rejected",
]);

export const hypothesesTable = biographSchema.table(
  "hypotheses",
  {
    id: uuid("id").notNull(),

    hypothesis: text("hypothesis").notNull(),

    filesUsed: text("files_used").array(),

    status: hypothesisStatusEnum("status").default("pending"),

    judgellmScore: numeric("judgellm_score", { precision: 5, scale: 2 }),

    humanScore: numeric("human_score", { precision: 5, scale: 2 }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id], name: "hypotheses_pkey" }),
    };
  }
);

export type Hypothesis = typeof hypothesesTable.$inferSelect;
export type NewHypothesis = typeof hypothesesTable.$inferInsert;
