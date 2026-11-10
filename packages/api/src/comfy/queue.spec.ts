import { ComfyJobQueue } from './queue';

describe('comfy/queue', () => {
  it('bounds concurrency to 1 and processes tasks sequentially', async () => {
    const queue = new ComfyJobQueue(1);
    const executionOrder: number[] = [];
    let concurrentRunning = 0;
    let maxSeenConcurrent = 0;

    const makeTask = (id: number, delayMs: number) => async () => {
      concurrentRunning++;
      maxSeenConcurrent = Math.max(maxSeenConcurrent, concurrentRunning);
      await new Promise((res) => setTimeout(res, delayMs));
      executionOrder.push(id);
      concurrentRunning--;
      return id;
    };

    const p1 = queue.run(makeTask(1, 30));
    const p2 = queue.run(makeTask(2, 20));
    const p3 = queue.run(makeTask(3, 10));

    expect(queue.isBusy).toBe(true);

    const results = await Promise.all([p1, p2, p3]);

    expect(results).toEqual([1, 2, 3]);
    expect(executionOrder).toEqual([1, 2, 3]);
    expect(maxSeenConcurrent).toBe(1);
    expect(queue.isBusy).toBe(false);
    expect(queue.pendingCount).toBe(0);
  });
});
