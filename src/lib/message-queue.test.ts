import { describe, it, expect } from "vitest";
import { AsyncQueue } from "./message-queue";

describe("AsyncQueue", () => {
  it("dequeues items in order", async () => {
    const queue = new AsyncQueue<string>();
    queue.enqueue("a");
    queue.enqueue("b");
    queue.enqueue("c");

    expect(await queue.dequeue()).toBe("a");
    expect(await queue.dequeue()).toBe("b");
    expect(await queue.dequeue()).toBe("c");
  });

  it("blocks dequeue until item is available", async () => {
    const queue = new AsyncQueue<string>();

    const dequeuePromise = queue.dequeue();
    // Give a tick to ensure promise is pending
    let resolved = false;
    dequeuePromise.then(() => {
      resolved = true;
    });
    await Promise.resolve(); // flush microtasks
    expect(resolved).toBe(false);

    queue.enqueue("hello");
    const result = await dequeuePromise;
    expect(result).toBe("hello");
  });

  it("returns null after close", async () => {
    const queue = new AsyncQueue<string>();
    queue.close();
    expect(await queue.dequeue()).toBeNull();
  });

  it("resolves pending dequeuers on close", async () => {
    const queue = new AsyncQueue<string>();
    const promise = queue.dequeue();
    queue.close();
    expect(await promise).toBeNull();
  });

  it("ignores enqueue after close", async () => {
    const queue = new AsyncQueue<string>();
    queue.enqueue("before");
    queue.close();
    queue.enqueue("after");

    expect(await queue.dequeue()).toBe("before");
    expect(await queue.dequeue()).toBeNull();
  });

  it("handles multiple waiting dequeuers", async () => {
    const queue = new AsyncQueue<number>();
    const p1 = queue.dequeue();
    const p2 = queue.dequeue();
    const p3 = queue.dequeue();

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    expect(await p1).toBe(1);
    expect(await p2).toBe(2);
    expect(await p3).toBe(3);
  });
});
