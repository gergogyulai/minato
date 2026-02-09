import pc from 'picocolors';
import { startIngestWorker } from './workers/ingest-worker';
import { startEnrichmentWorker } from './workers/enrichment-worker';
import { startReindexWorker } from './workers/reindex-worker';
import { logger } from './utils/logger';
import { connection } from '@project-minato/queue';
import { meiliClient, setupTorrentIndex } from '@project-minato/meilisearch';
import { db } from '@project-minato/db';
import { sql } from 'drizzle-orm';

async function checkConnections() {
  const checks = {
    redis: false,
    meilisearch: false,
    database: false,
  };

  try {
    await connection.ping();
    checks.redis = true;
    logger.step('Redis', 'CONNECTED');
  } catch (err) {
    logger.error('Redis connection failed');
    throw err;
  }

  try {
    await meiliClient.health();
    checks.meilisearch = true;
    logger.step('MeiliSearch', 'CONNECTED');
    
    await setupTorrentIndex();
    logger.step('MeiliSearch Index', 'INITIALIZED');
  } catch (err) {
    logger.error('MeiliSearch connection failed');
    throw err;
  }

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
    logger.step('Database', 'CONNECTED');
  } catch (err) {
    logger.error('Database connection failed');
    throw err;
  }

  return checks;
}

async function bootstrap() {
  console.clear();
  console.log(pc.magenta(pc.bold('◢ PROJECT MINATO')));
  logger.info('Initializing worker mesh...');
  console.log('');

  await checkConnections();
  console.log('');

  const ingestWorker = startIngestWorker();
  const enrichmentWorker = startEnrichmentWorker();
  const reindexWorker = startReindexWorker();

  logger.step('Ingest Worker', 'PASS_1_ACTIVE');
  logger.step('Enrichment Worker', 'PASS_2_ACTIVE');
  logger.step('Reindex Worker', 'REINDEX_ACTIVE');
  
  console.log('');
  logger.success('System heartbeat stable');
  console.log(pc.dim('Press Ctrl+C to terminate process\n'));

  async function shutdown(signal: string) {
    console.log('');
    logger.warn(`Signal ${pc.bold(signal)} received. Cooling down...`);
    
    try {
      await Promise.all([
        ingestWorker.close(),
        enrichmentWorker.close(),
        reindexWorker.close(),
      ]);
      
      // Close Redis connection
      await connection.quit();
      
      logger.success('Cleanup complete. Fly safe.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown');
      process.exit(1);
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error('Failed to bootstrap Minato');
  console.error(err);
  process.exit(1);
});