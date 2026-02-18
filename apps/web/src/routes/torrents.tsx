import { createFileRoute, Outlet } from "@tanstack/react-router";

import TorrentHeader from "@/components/torrent-header";

export const Route = createFileRoute("/torrents")({
  component: TorrentsLayout,
});

function TorrentsLayout() {
  return (
    <>
      <TorrentHeader />
      <div className="pt-14.25">
        <Outlet />
      </div>
    </>
  );
}
