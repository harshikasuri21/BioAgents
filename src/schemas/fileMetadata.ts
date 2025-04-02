import {
  pgTable,
  pgSchema,
  text,
  bigint,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const biographSchema = pgSchema("biograph");

export const fileMetadataTable = biographSchema.table(
  "file_metadata",
  {
    hash: text("hash").notNull(),

    fileName: text("file_name").notNull(),

    fileSize: bigint("file_size", { mode: "number" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    modifiedAt: timestamp("modified_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    tags: text("tags").array(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.hash], name: "file_metadata_pkey" }),
    };
  }
);

// Type for selecting data (matches the table structure)
export type FileMetadata = typeof fileMetadataTable.$inferSelect;

// Type for inserting data (useful for creating new records)
export type NewFileMetadata = typeof fileMetadataTable.$inferInsert;
