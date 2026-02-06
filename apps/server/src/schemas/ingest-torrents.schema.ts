import { z } from "zod";

const FileInfoSchema = z
  .union([
    z.object({
      name: z.string(),
      length: z.number().int(),
    }),

    z.object({
      name: z.string(),
      files: z.array(
        z.object({
          path: z.array(z.string()),
          length: z.number().int(),
        })
      ),
    }),
  ])
  .transform((data) => {
    // If it's a multi-file torrent
    if ("files" in data) {
      return data.files.map((f) => ({
        // Join the path array (e.g., ["folder", "file.txt"] -> "folder/file.txt")
        filename: f.path.join("/"),
        size: f.length,
      }));
    }

    // If it's a single file torrent
    return [
      {
        filename: data.name,
        size: data.length,
      },
    ];
  });


export const IngestTorrentsSchema = z.object({
  infoHash: z.string().length(40),
  title: z.string(),
  size: z
    .string()
    .regex(/^\d+$/, "Size must be a string of digits")
    .refine((val) => {
      try {
        const b = BigInt(val);
        // Postgres bigint
        return b >= 0n && b <= 9223372036854775807n;
      } catch {
        return false;
      }
    }, "Size exceeds 64-bit integer limit"),
  seeders: z.number().default(0),
  leechers: z.number().default(0),
  category: z.string().optional(),
  magnet: z.string().regex(/^magnet:\?xt=urn:[a-z0-9]+:[a-z0-9]{32,40}/i).optional(),
  files: FileInfoSchema.optional(),
  source: z.object({
    name: z.string(),
    scraperId: z.string().optional(),
    url: z.url().optional(),
  })
});