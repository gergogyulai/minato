import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/torrents")({
  component: TorrentsLayout,
});

function TorrentsLayout() {
  return <Outlet />;
}
