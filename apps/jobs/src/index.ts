import pc from 'picocolors';
import { startIngestWorker } from './workers/ingest-worker';
import { startEnrichmentWorker } from './workers/enrichment-worker';
import { logger } from './utils/logger';

async function bootstrap() {
  console.clear();
  console.log(pc.magenta(pc.bold('◢ PROJECT MINATO')));
  logger.info('Initializing worker mesh...');
  console.log('');

  const ingestWorker = startIngestWorker();
  const enrichmentWorker = startEnrichmentWorker();

  logger.step('Ingest Worker', 'PASS_1_ACTIVE');
  logger.step('Enrichment Worker', 'PASS_2_ACTIVE');
  
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
      ]);
      
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