import { z } from "zod";
import { publicProcedure } from "..";

export const discoverSuggestionsContract = publicProcedure
  .route({
    method: "POST",
    