import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export type SetupStep = "admin" | "scrapers" | "flaresolverr";

export interface SettingsData {
  setupCompleted: boolean;
  flareSolverrUrl: string;
  enabledScrapers: string[];
  setupProgress?: {
    currentStep: SetupStep;
    completedSteps: SetupStep[];
  };
}

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("default"),
  data: jsonb("data").$type<SettingsData>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

// Default settings
export const defaultSettings: SettingsData = {
  setupCompleted: false,
  flareSolverrUrl: "http://localhost:8191",
  enabledScrapers: ["1337x", "thepiratebay", "knaben", "eztv", "yts"],
  setupProgress: {
    currentStep: "admin",
    completedSteps: [],
  },
};
