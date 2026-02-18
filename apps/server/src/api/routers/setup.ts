import { ORPCError } from "@orpc/server";
import { db, settings, user, eq, sql, defaultSettings } from "@project-minato/db";
import type { SettingsData } from "@project-minato/db";
import { auth } from "@project-minato/auth";
import { FlareSolverr } from "@project-minato/api-clients";
import {
  getStatusContract,
  createAdminContract,
  getScrapersContract,
  updateScrapersContract,
  checkFlareSolverrContract,
  updateFlareSolverrContract,
  updateSetupProgressContract,
  completeSetupContract,
} from "../contracts/setup.contracts";

// Define available scrapers
const AVAILABLE_SCRAPERS = [
  { id: "1337x", name: "1337x", description: "Popular torrent indexer" },
  { id: "thepiratebay", name: "The Pirate Bay", description: "Classic torrent site" },
  { id: "knaben", name: "Knaben", description: "Torrent metasearch engine" },
  { id: "eztv", name: "EZTV", description: "TV torrents specialist" },
  { id: "yts", name: "YTS", description: "High-quality movie torrents" },
];

export const setupRouter = {
  getStatus: getStatusContract.handler(async () => {
    // Check if settings exist
    let currentSettings = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
    
    // Initialize settings if not exists
    if (currentSettings.length === 0) {
      await db.insert(settings).values({
        id: "default",
        data: defaultSettings,
      });
      currentSettings = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
    }

    // Check if any admin user exists
    const adminCount = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(user)
      .where(eq(user.role, "admin"));

    const hasAdminUser = (adminCount[0]?.count ?? 0) > 0;
    const settingsData = (currentSettings[0]?.data as SettingsData) ?? defaultSettings;

    return {
      setupCompleted: settingsData.setupCompleted ?? false,
      hasAdminUser,
      setupProgress: settingsData.setupProgress,
    };
  }),

  createAdmin: createAdminContract.handler(async ({ input }) => {
    const currentSettings = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
    
    if (currentSettings.length > 0 && (currentSettings[0]?.data as SettingsData)?.setupCompleted) {
      throw new ORPCError("FORBIDDEN", {
        message: "Setup has already been completed. Cannot create admin through setup flow.",
      });
    }

    const adminCount = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(user)
      .where(eq(user.role, "admin"));

    if ((adminCount[0]?.count ?? 0) > 0) {
      throw new ORPCError("FORBIDDEN", {
        message: "An admin user already exists.",
      });
    }

    // Create admin user using BetterAuth
    try {
      const newUser = await auth.api.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
        },
      });

      // Update user role to admin
      await db
        .update(user)
        .set({ role: "admin" })
        .where(eq(user.id, newUser.user.id));

      return {
        success: true,
        message: "Admin account created successfully",
      };
    } catch (error) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: error instanceof Error ? error.message : "Failed to create admin account",
      });
    }
  }),

  getScrapers: getScrapersContract.handler(async () => {
    // Get current settings
    let currentSettings = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
    
    if (currentSettings.length === 0) {
      // Initialize with defaults
      await db.insert(settings).values({
        id: "default",
        data: defaultSettings,
      });
      currentSettings = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
    }

    const settingsData = currentSettings[0]?.data as SettingsData;
    const enabledScrapers = settingsData?.enabledScrapers ?? [];

    return {
      scrapers: AVAILABLE_SCRAPERS.map((scraper) => ({
        ...scraper,
        enabled: enabledScrapers.includes(scraper.id),
      })),
    };
  }),

  updateScrapers: updateScrapersContract.handler(async ({ input }) => {
    // Validate that all provided scrapers are valid
    const validScraperIds = AVAILABLE_SCRAPERS.map((s) => s.id);
    const invalidScrapers = input.enabledScrapers.filter((id) => !validScraperIds.includes(id));

    if (invalidScrapers.length > 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Invalid scraper IDs: ${invalidScrapers.join(", ")}`,
      });
    }

    // Get current settings
    const currentSettings = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
    const currentData = (currentSettings[0]?.data as SettingsData) ?? defaultSettings;

    // Update settings
    await db
      .update(settings)
      .set({
        data: {
          ...currentData,
          enabledScrapers: input.enabledScrapers,
        },
        updatedAt: new Date(),
      })
      .where(eq(settings.id, "default"));

    return {
      success: true,
      message: "Scrapers configuration updated successfully",
    };
  }),

  checkFlareSolverr: checkFlareSolverrContract.handler(async ({ input }) => {
    try {
      const client = new FlareSolverr(input.url);
      const response = await client.listSessions();

      return {
        success: true,
        message: "FlareSolverr is working correctly",
        version: response.version,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to connect to FlareSolverr",
      };
    }
  }),

  updateFlareSolverr: updateFlareSolverrContract.handler(async ({ input }) => {
    // Get current settings
    const currentSettings = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
    const currentData = (currentSettings[0]?.data as SettingsData) ?? defaultSettings;

    await db
      .update(settings)
      .set({
        data: {
          ...currentData,
          flareSolverrUrl: input.url,
        },
        updatedAt: new Date(),
      })
      .where(eq(settings.id, "default"));

    return {
      success: true,
      message: "FlareSolverr URL updated successfully",
    };
  }),

  updateProgress: updateSetupProgressContract.handler(async ({ input }) => {
    // Get current settings
    const currentSettings = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
    const currentData = (currentSettings[0]?.data as SettingsData) ?? defaultSettings;

    await db
      .update(settings)
      .set({
        data: {
          ...currentData,
          setupProgress: {
            currentStep: input.currentStep,
            completedSteps: input.completedSteps,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(settings.id, "default"));

    return {
      success: true,
      message: "Setup progress updated successfully",
    };
  }),

  completeSetup: completeSetupContract.handler(async () => {
    // Verify that an admin user exists before completing setup
    const adminCount = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(user)
      .where(eq(user.role, "admin"));

    if ((adminCount[0]?.count ?? 0) === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cannot complete setup without creating an admin account first",
      });
    }

    // Get current settings
    const currentSettings = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
    const currentData = (currentSettings[0]?.data as SettingsData) ?? defaultSettings;

    await db
      .update(settings)
      .set({
        data: {
          ...currentData,
          setupCompleted: true,
        },
        updatedAt: new Date(),
      })
      .where(eq(settings.id, "default"));

    return {
      success: true,
      message: "Setup completed successfully",
    };
  }),
};
