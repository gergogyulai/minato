import { ORPCError } from "@orpc/server";
import { db, user, eq, sql } from "@project-minato/db";
import { auth } from "@project-minato/auth";
import { FlareSolverr } from "@project-minato/api-clients";
import { getConfig, writeConfigKey } from "@project-minato/config";
import type { SetupStep } from "@project-minato/config";
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

// ---------------------------------------------------------------------------
// Static catalogue – never changes at runtime
// ---------------------------------------------------------------------------

const AVAILABLE_SCRAPERS = [
  { id: "1337x", name: "1337x", description: "Popular torrent indexer" },
  { id: "thepiratebay", name: "The Pirate Bay", description: "Classic torrent site" },
  { id: "knaben", name: "Knaben", description: "Torrent metasearch engine" },
  { id: "eztv", name: "EZTV", description: "TV torrents specialist" },
  { id: "yts", name: "YTS", description: "High-quality movie torrents" },
] as const;

const VALID_SCRAPER_IDS = AVAILABLE_SCRAPERS.map((s) => s.id) as string[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEP_ORDER: SetupStep[] = ["admin", "scrapers", "flaresolverr"];

async function hasAdminUser(): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(user)
    .where(eq(user.role, "admin"));
  return (row?.count ?? 0) > 0;
}

/**
 * Mark `completedStep` as done and advance `currentStep` to the next one.
 * Only runs when setup is not yet completed.
 * Uses silent=true so it never triggers a version bump / reload / broadcast.
 */
async function advanceSetupProgress(completedStep: SetupStep): Promise<void> {
  const { setup } = getConfig();
  if (setup.setupCompleted) return;

  const current = setup.setupProgress ?? {
    currentStep: "admin" as SetupStep,
    completedSteps: [] as SetupStep[],
  };

  const completedSteps = current.completedSteps.includes(completedStep)
    ? current.completedSteps
    : [...current.completedSteps, completedStep];

  const nextIndex = STEP_ORDER.indexOf(completedStep) + 1;
  const currentStep: SetupStep =
    nextIndex < STEP_ORDER.length
      ? (STEP_ORDER[nextIndex] as SetupStep)
      : (STEP_ORDER[STEP_ORDER.length - 1] as SetupStep);

  await writeConfigKey(
    db,
    "setup.setupProgress",
    { currentStep, completedSteps },
    { silent: true },
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const setupRouter = {
  getStatus: getStatusContract.handler(async () => {
    const { setup } = getConfig();
    return {
      setupCompleted: setup.setupCompleted,
      hasAdminUser: await hasAdminUser(),
      setupProgress: setup.setupProgress,
    };
  }),

  createAdmin: createAdminContract.handler(async ({ input }) => {
    if (getConfig().setup.setupCompleted) {
      throw new ORPCError("FORBIDDEN", {
        message: "Setup has already been completed. Cannot create admin through setup flow.",
      });
    }

    if (await hasAdminUser()) {
      throw new ORPCError("FORBIDDEN", {
        message: "An admin user already exists.",
      });
    }

    try {
      const newUser = await auth.api.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
        },
      });

      await db
        .update(user)
        .set({ role: "admin" })
        .where(eq(user.id, newUser.user.id));

      await advanceSetupProgress("admin");

      return { success: true, message: "Admin account created successfully" };
    } catch (error) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: error instanceof Error ? error.message : "Failed to create admin account",
      });
    }
  }),

  getScrapers: getScrapersContract.handler(() => {
    const { setup } = getConfig();
    return {
      scrapers: AVAILABLE_SCRAPERS.map((scraper) => ({
        ...scraper,
        enabled: setup.enabledScrapers.includes(scraper.id),
      })),
    };
  }),

  updateScrapers: updateScrapersContract.handler(async ({ input }) => {
    const invalid = input.enabledScrapers.filter((id) => !VALID_SCRAPER_IDS.includes(id));
    if (invalid.length > 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Invalid scraper IDs: ${invalid.join(", ")}`,
      });
    }

    await writeConfigKey(db, "setup.enabledScrapers", input.enabledScrapers);
    await advanceSetupProgress("scrapers");
    return { success: true, message: "Scrapers configuration updated successfully" };
  }),

  checkFlareSolverr: checkFlareSolverrContract.handler(async ({ input }) => {
    try {
      const client = new FlareSolverr(input.url);
      const response = await client.listSessions();
      return {
        success: true,
        message: "FlareSolverr is working correctly",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        version: (response as any).version as string | undefined,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to connect to FlareSolverr",
      };
    }
  }),

  updateFlareSolverr: updateFlareSolverrContract.handler(async ({ input }) => {
    await writeConfigKey(db, "setup.flareSolverrUrl", input.url);
    await advanceSetupProgress("flaresolverr");
    return { success: true, message: "FlareSolverr URL updated successfully" };
  }),

  updateProgress: updateSetupProgressContract.handler(async ({ input }) => {
    const progress: { currentStep: SetupStep; completedSteps: SetupStep[] } = {
      currentStep: input.currentStep as SetupStep,
      completedSteps: input.completedSteps as SetupStep[],
    };
    await writeConfigKey(db, "setup.setupProgress", progress, { silent: true });
    return { success: true, message: "Setup progress updated successfully" };
  }),

  completeSetup: completeSetupContract.handler(async () => {
    if (!(await hasAdminUser())) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cannot complete setup without creating an admin account first.",
      });
    }

    await writeConfigKey(db, "setup.setupCompleted", true);
    return { success: true, message: "Setup completed successfully" };
  }),
};
