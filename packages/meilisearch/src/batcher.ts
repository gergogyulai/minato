import { meiliClient } from "@project-minato/meilisearch";

/**
 * A utility class to batch document additions to Meilisearch.
 * 
 * This helps optimize performance and avoid hitting rate limits or 
 * overhead by grouping multiple document updates into a single request 
 * based on a count threshold or a time delay.
 */
export class MeiliBatcher {
  private buffer: any[] = [];
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  /**
   * Creates an instance of MeiliBatcher.
   * 
   * @param indexName - The name of the Meilisearch index to target.
   * @param batchSize - The maximum number of documents to collect before triggering a flush. Defaults to 50.
   * @param timeout - The amount of time (in ms) to wait before flushing an incomplete batch. Defaults to 5000ms.
   */
  constructor(
    private readonly indexName: string,
    private readonly batchSize = 50,
    private readonly timeout = 5000,
  ) {}

  /**
   * Adds a document to the batch buffer.
   * 
   * If the buffer reaches the `batchSize`, a flush is triggered immediately. 
   * Otherwise, a timer is started to flush after the `timeout` period.
   * 
   * @param document - The document object to be indexed in Meilisearch.
   * @returns A promise that resolves when the document is added to the buffer.
   */
  async add(document: any) {
    this.buffer.push(document);

    // If we hit the limit and aren't already flushing, trigger it
    if (this.buffer.length >= this.batchSize && !this.isFlushing) {
      await this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Sets a timer to trigger a flush if one is not already scheduled or in progress.
   * @private
   */
  private scheduleFlush() {
    if (this.timer || this.isFlushing) return;
    this.timer = setTimeout(() => this.flush(), this.timeout);
  }

  /**
   * Sends the current buffer of documents to Meilisearch.
   * 
   * In the event of a network or API failure, the items are returned to the 
   * beginning of the buffer to be retried in the next cycle.
   * 
   * @returns A promise that resolves once the flush operation is complete.
   */
  async flush() {
    if (this.isFlushing || this.buffer.length === 0) return;
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.isFlushing = true;
    const itemsToProcess = [...this.buffer];
    this.buffer = [];

    try {
      console.log(`[Batcher] Indexing ${itemsToProcess.length} items...`);
      
      await meiliClient
        .index(this.indexName)
        .addDocuments(itemsToProcess, { primaryKey: "infoHash" });
        
    } catch (error) {
      console.error(`[Batcher] Critical Failure:`, error);
      // Re-insert failed items at the front of the queue
      this.buffer = [...itemsToProcess, ...this.buffer];
    } finally {
      this.isFlushing = false;
      
      // If items were added while we were flushing, or items were returned 
      // to the buffer via catch, check if we need to schedule another flush.
      if (this.buffer.length > 0) {
        this.scheduleFlush();
      }
    }
  }
}