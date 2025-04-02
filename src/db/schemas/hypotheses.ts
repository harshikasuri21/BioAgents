import { uuid, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { biographPgSchema } from "./biographPgSchema";
import { hypothesisStatusEnum } from "./customTypes";

export const hypothesesTable = biographPgSchema.table("hypotheses", {
  id: uuid("id").notNull().primaryKey(),
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
});

export type Hypothesis = typeof hypothesesTable.$inferSelect;
export type NewHypothesis = typeof hypothesesTable.$inferInsert;
