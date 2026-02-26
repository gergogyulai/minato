import { Job } from 'bullmq';

export async function syncMeilisearch(job: Job) {
  console.log('[Housekeeper] Syncing Meilisearch index...');
}