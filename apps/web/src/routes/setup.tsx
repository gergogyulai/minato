import { createFileRoute, redirect } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/setup")({
  beforeLoad: async ({ context }) => {
    const setupStatus = await context.queryClient.ensureQueryData(
      context.orpc.setup.getStatus.queryOptions()
    );
    
    if (setupStatus.setupCompleted) {
      redirect({
        to: "/",
        throw: true,
      });
    }
  },
});
