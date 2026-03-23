/**
 * Async queue that blocks on dequeue until an item is available.
 * Used to feed user messages into the SDK's async generator prompt.
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: T | null) => void)[] = [];
  private closed = false;

  enqueue(item: T): void {
    if (this.closed) return;

    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(item);
    } else {
      this.queue.push(item);
    }
  }

  dequeue(): Promise<T | null> {
    if (this.queue.length > 0) {
      return Promise.resolve(this.queue.shift()!);
    }

    if (this.closed) {
      return Promise.resolve(null);
    }

    return new Promise<T | null>((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  close(): void {
    this.closed = true;
    // Resolve any waiting dequeuers with null
    for (const resolve of this.resolvers) {
      resolve(null);
    }
    this.resolvers = [];
  }
}
