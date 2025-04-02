import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./src/schemas/*",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
  schemaFilter: ["biograph"],
} satisfies Config;
