import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

interface AssetInput {
  id: string; // The InfoHash or TMDB/IMDb ID
  url: string; // The source URL from the metadata provider
  type: "poster" | "backdrop";
}

/**
 * Downloads and processes an image asset using a sharded directory structure.
 */
export async function ingestAsset({ id, url, type }: AssetInput) {
  const { absolute } = getLocalAssetPaths(id, type);

  // 2. Check if file already exists to avoid redundant downloads
  const file = Bun.file(absolute);
  if (await file.exists()) {
    return { path: absolute, status: "exists" };
  }

  try {
    // 3. Ensure directory exists
    await fs.mkdir(path.dirname(absolute), { recursive: true });

    // 4. Download the image
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Process with Sharp
    const pipeline = sharp(buffer).webp({ quality: 80 });

    if (type === "poster") {
      pipeline.resize(500, 750, { fit: "cover" }); // Standard Poster Ratio
    } else {
      pipeline.resize(1280, 720, { fit: "inside" }); // Backdrops are larger
    }

    await pipeline.toFile(absolute);

    return { path: absolute, status: "downloaded and processed" };
  } catch (error) {
    console.error(`[MediaIngest] Error processing ${type} for ${id}:`, error);
    throw error;
  }
}

/**
 * Returns consistent relative and absolute paths for an asset
 */
export function getLocalAssetPaths(
  id: string | number,
  type: "poster" | "backdrop",
) {
  const strId = String(id);
  const shard = strId.substring(0, 2).toLowerCase();

  // The relative path stored in the DB and used by the browser/Nginx
  const relativeDir = `/${shard}/${strId}`;
  const relativeFile = `${relativeDir}/${type}.webp`;

  // The absolute path on the disk for filesystem operations
  const mediaRoot = process.env.MEDIA_ROOT || "../../data/media";
  const absolutePath = path.join(mediaRoot, relativeFile);

  return {
    relative: relativeFile, // Store this in DB
    absolute: absolutePath, // Use this for Sharp
  };
}
