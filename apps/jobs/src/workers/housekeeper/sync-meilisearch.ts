import { Job } from 'bullmq';
import { logger } from '@/utils/logger';

const log = logger.child({ task: 'sync-meilisearch' });

export async function syncMeilisearch(_job: Job) {
  log.info('Syncing Meilisearch index...');
}
