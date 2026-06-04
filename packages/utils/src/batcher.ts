export interface BatcherOptions<T> {
  maxSize: number;
  maxWaitMs: number;
  onFlush: (batch: T[]) => Promise<void>;
  onError?: (error: unknown, failedBatch: T[]) => void;
}

export class Batcher<T> {
  private buffer: T[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> = Promise.resolve();
  private destroyed = false;

  constructor(private readonly options: BatcherOptions<T>) {
    if (options.maxSize < 1) throw new RangeError("maxSize must be >= 1");
    if (options.maxWaitMs < 0) throw new RangeError("maxWaitMs must be >= 0");
  }

  /**
   * Fire-and-forget. Pushes an item and triggers flush mechanics.
   * Callers are never blocked by I/O — errors route through `onError`.
   */
  add(item: T): void {
    if (this.destroyed) throw new Error("Batcher is destroyed");

    this.buffer.push(item);

    if (this.buffer.length >= this.options.maxSize) {
      this.clearTimer();
      this.requestFlush();
    } else if (this.timer === null) {
      this.startTimer();
    }
  }

  /** Force-flush all buffered items. Resolves when the buffer is fully drained. */
  async flush(): Promise<void> {
    this.clearTimer();
    this.requestFlush();
    await this.flushing;
  }

  /** Flush remaining items, cancel timers, reject future `add()` calls. */
  async destroy(): Promise<void> {
    this.destroyed = true;
    this.clearTimer();
    this.requestFlush();
    await this.flushing;
  }

  get size(): number {
    return this.buffer.length;
  }

  /**
   * Appends a drain onto the serialized flush chain.
   * Multiple rapid calls are safe — subsequent drains no-op on an empty buffer.
   */
  private requestFlush(): void {
    this.flushing = this.flushing.then(() => this.drain());
  }

  /**
   * Drains the buffer in `maxSize`-chunks. Items added by concurrent
   * `add()` calls during an `await onFlush()` are picked up by the
   * next while-loop iteration — no timer or re-entry needed.
   */
  private async drain(): Promise<void> {
    while (this.buffer.length > 0) {
      const batch = this.buffer.splice(0, this.options.maxSize);
      try {
        await this.options.onFlush(batch);
      } catch (err) {
        try {
          this.options.onError?.(err, batch);
        } catch {
          // Swallow onError failures to keep the drain loop alive.
        }
      }
    }
  }

  private startTimer(): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      this.requestFlush();
    }, this.options.maxWaitMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}