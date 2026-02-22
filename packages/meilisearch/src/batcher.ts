import { meiliClient } from "./client";

/**
 * A utility class to batch document additions to Meilisearch.
 *
 * Optimizes performance by grouping multiple document updates into a
 * single request, triggered by a count threshold or a time delay.
 */
export class MeiliBatcher {
  private buffer: any[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  /**
   * @param indexName - The Meilisearch index to target.
   * @param batchSize - Max documents before triggering an immediate flush. Defaults to 50.
   * @param timeout - Time (ms) to wait before flushing an incomplete batch. Defaults to 5000.
   */
  constructor(
    private readonly indexName: string,
    private readonly batchSize = 50,
    private readonly timeout = 5000,
  ) {}

  /**
   * Adds a document to the batch. Triggers an immediate flush if the
   * buffer reaches `batchSize`, otherwise schedules a deferred flush.
   */
  async add(document: any) {
    this.buffer.push(document);

    if (!this.flushing && this.buffer.length >= this.batchSize) {
      await this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.timer || this.flushing) return;
    this.timer = setTimeout(() => this.flush(), this.timeout);
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Flushes the current buffer to Meilisearch. On failure, items are
   * returned to the front of the buffer and retried after `timeout` ms.
   * On success, immediately re-flushes if the buffer refilled to capacity.
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;

    this.clearTimer();
    this.flushing = true;

    const batch = this.buffer.splice(0);
    let failed = false;

    try {
      console.log(`[Batcher] Indexing ${batch.length} items...`);
      await meiliClient
        .index(this.indexName)
        .addDocuments(batch, { primaryKey: "infoHash" });
    } catch (error) {
      console.error(`[Batcher] Critical Failure:`, error);
      this.buffer.unshift(...batch);
      failed = true;
    } finally {
      this.flushing = false;

      // On success: re-flush immediately if we have a full batch ready,
      // avoiding a full timeout wait for items that arrived mid-flush.
      // On failure: always fall back to timer to avoid hammering the server.
      if (!failed && this.buffer.length >= this.batchSize) {
        await this.flush();
      } else if (this.buffer.length > 0) {
        this.scheduleFlush();
      }
    }
  }
}