import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null,
});

const redis = connection;

export const QUEUES = {
  INGEST : 'torrent_ingest',
  ENRICH: 'torrent_enrich',
  FULLREINDEX: 'torrent_reindex',
} as const;

export const ingestQueue = new Queue(QUEUES.INGEST, { connection });
export const enrichQueue = new Queue(QUEUES.ENRICH, { connection });
export const reindexQueue = new Queue(QUEUES.FULLREINDEX, { connection });

export { Worker, QueueEvents, connection, redis }; 