export class TimeoutError extends Error {
  constructor(message = 'Dedupe timeout exceeded') {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface TrackedPromise<T> {
  promise: Promise<T>;
  timeoutId: NodeJS.Timeout;
  abortController: AbortController;
}

export class Deduper {
  private map = new Map<string, TrackedPromise<any>>();
  private maxSize = 10000;

  constructor(public namespace: string) {}

  async run<T>(key: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const fullKey = `${this.namespace}:${key}`;

    if (this.map.has(fullKey)) {
      return this.map.get(fullKey)!.promise;
    }

    if (this.map.size >= this.maxSize) {
      console.warn(`[Deduper] Namespace ${this.namespace} exceeded 10,000 keys. Bypassing dedup.`);
      return fn(new AbortController().signal);
    }

    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const execute = async () => {
      try {
        const result = await Promise.race([
          fn(abortController.signal),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new TimeoutError()), 10000);
          })
        ]);
        return result;
      } catch (err) {
        if (err instanceof TimeoutError) {
          abortController.abort();
        }
        this.map.delete(fullKey); // Instantly evict on failure/timeout
        throw err;
      } finally {
        clearTimeout(timeoutId!);
        this.map.delete(fullKey);
      }
    };

    const promise = execute();
    this.map.set(fullKey, { promise, timeoutId: timeoutId!, abortController });

    return promise;
  }
}

const instances = new Map<string, Deduper>();

export function createDeduper(namespace: string): Deduper {
  if (instances.has(namespace)) return instances.get(namespace)!;
  const dedup = new Deduper(namespace);
  instances.set(namespace, dedup);
  return dedup;
}
