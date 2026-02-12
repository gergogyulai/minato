import { TorrentTable } from "@/components/torrent-table";

export default async function DashboardPage() {
  const torrents = await fetch("http://localhost:3000/api/v1/search/torrents").then(res => res.json());

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Browse Torrents</h1>
      <ul className="space-y-2">
        <TorrentTable data={torrents} />
      </ul>
    </div>
  );
}