import { publicProcedure } from "../index";
import {
  GetSetupStatusResponseSchema,
  CreateAdminSchema,
  CreateAdminResponseSchema,
  GetScrapersResponseSchema,
  UpdateScrapersSchema,
  UpdateScrapersResponseSchema,
  CheckFlareSolverrSchema,
  CheckFlareSolverrResponseSchema,
  UpdateFlareSolverrSchema,
  UpdateFlareSolverrResponseSchema,
  UpdateSetupProgressSchema,
  UpdateSetupProgressResponseSchema,
  CompleteSetupResponseSchema,
} from "@/schemas/setup.schema";
import { z } from "zod";

export const getStatusContract = publicProcedure
  .route({
    method: "GET",
    path: "/setup/status",
    summary: "Get setup status",
    description: "Check if initial setup has been completed and if an admin user exists.",
    tags: ["setup"],
  })
  .input(z.void())
  .output(GetSetupStatusResponseSchema);

export const createAdminContract = publicProcedure
  .route({
    method: "POST",
    path: "/setup/admin",
    summary: "Create first admin account",
    description: "Create the initial admin account during setup. Can only be called when setup is not completed.",
    tags: ["setup"],
  })
  .input(CreateAdminSchema)
  .output(CreateAdminResponseSchema);

export const getScrapersContract = publicProcedure
  .route({
    method: "GET",
    path: "/setup/scrapers",
    summary: "Get scrapers configuration",
    description: "Get list of all available scrapers and their enabled status.",
    tags: ["setup"],
  })
  .input(z.void())
  .output(GetScrapersResponseSchema);

export const updateScrapersContract = publicProcedure
  .route({
    method: "POST",
    path: "/setup/scrapers",
    summary: "Update scrapers configuration",
    description: "Update which scrapers are enabled or disabled.",
    tags: ["setup"],
  })
  .input(UpdateScrapersSchema)
  .output(UpdateScrapersResponseSchema);

export const checkFlareSolverrContract = publicProcedure
  .route({
    method: "POST",
    path: "/setup/flaresolverr/check",
    summary: "Check FlareSolverr connectivity",
    description: "Test connection to FlareSolverr at the specified URL.",
    tags: ["setup"],
  })
  .input(CheckFlareSolverrSchema)
  .output(CheckFlareSolverrResponseSchema);

export const updateFlareSolverrContract = publicProcedure
  .route({
    method: "POST",
    path: "/setup/flaresolverr",
    summary: "Update FlareSolverr URL",
    description: "Update the FlareSolverr URL in configuration.",
    tags: ["setup"],
  })
  .input(UpdateFlareSolverrSchema)
  .output(UpdateFlareSolverrResponseSchema);

export const updateSetupProgressContract = publicProcedure
  .route({
    method: "POST",
    path: "/setup/progress",
    summary: "Update setup progress",
    description: "Update the current step and completed steps in the setup flow.",
    tags: ["setup"],
  })
  .input(UpdateSetupProgressSchema)
  .output(UpdateSetupProgressResponseSchema);

export const completeSetupContract = publicProcedure
  .route({
    method: "POST",
    path: "/setup/complete",
    summary: "Complete setup",
    description: "Mark the initial setup as completed.",
    tags: ["setup"],
  })
  .input(z.void())
  .output(CompleteSetupResponseSchema);

export const setupContracts = {
  getStatus: getStatusContract,
  createAdmin: createAdminContract,
  getScrapers: getScrapersContract,
  updateScrapers: updateScrapersContract,
  checkFlareSolverr: checkFlareSolverrContract,
  updateFlareSolverr: updateFlareSolverrContract,
  updateProgress: updateSetupProgressContract,
  completeSetup: completeSetupContract,
};
