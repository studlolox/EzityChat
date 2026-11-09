export interface QueueItem<T> {
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export class ComfyJobQueue {
  private activeCount = 0;
  private readonly maxConcurrent: number;
  private queue: Array<QueueItem<unknown>> = [];

  constructor(maxConcurrent = 1) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  public get pendingCount(): number {
    return this.queue.length;
  }

  public get isBusy(): boolean {
    return this.activeCount >= this.maxConcurrent;
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      try {
        return await task();
      } finally {
        this.activeCount--;
        this.processNext();
      }
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
  }

  private processNext(): void {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    this.activeCount++;
    (async () => {
      try {
        const result = await next.task();
        next.resolve(result);
      } catch (err) {
        next.reject(err);
      } finally {
        this.activeCount--;
        this.processNext();
      }
    })();
  }
}

export const globalComfyQueue: ComfyJobQueue = new ComfyJobQueue(1);
