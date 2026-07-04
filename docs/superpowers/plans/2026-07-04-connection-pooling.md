# Connection Pooling & Idempotency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement in-flight read deduplication and Redis batching utilities to increase efficiency and maintain idempotency.

**Architecture:** We will create a `dedupRead` utility with single-instance map-based tracking and timeout handling, and we will enhance the existing `redis.ts` with chunked pipeline helpers for Upstash.

**Tech Stack:** TypeScript, `@upstash/redis`

---

### Task 1: Setup & TDD Harness

We will use manual test scripts run via `npx tsx` to test these complex timing behaviors without needing to install a full test framework.

**Files:**
- Create: `backend/test-dedupe.ts`

- [ ] **Step 1: Write the failing test for dedupe**

```typescript
// backend/test-dedupe.ts
import { createDeduper } from './lib/dedupe';

async function runTests() {
  const deduper = createDeduper('test');
  let calls = 0;
  
  const fn = async (signal: AbortSignal) => {
    calls++;
    await new Promise(r => setTimeout(r, 100));
    return 'data';
  };

  const [res1, res2] = await Promise.all([
    deduper.run('key1', fn),
    deduper.run('key1', fn)
  ]);

  if (calls !== 1) throw new Error(`Failed: calls should be 1 but was ${calls}`);
  if (res1 !== 'data' || res2 !== 'data') throw new Error('Failed: incorrect results');
  
  console.log('Dedup test passed!');
}

runTests().catch(console.error);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx backend/test-dedupe.ts`
Expected: FAIL with "Cannot find module './lib/dedupe'"

- [ ] **Step 3: Commit**

```bash
git add backend/test-dedupe.ts
git commit -m "test: add dedupe test harness"
```

### Task 2: Implement `dedupe.ts`

**Files:**
- Create: `backend/lib/dedupe.ts`

- [ ] **Step 1: Write implementation**

```typescript
// backend/lib/dedupe.ts
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
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx backend/test-dedupe.ts`
Expected: `Dedup test passed!`

- [ ] **Step 3: Commit**

```bash
git add backend/lib/dedupe.ts
git commit -m "feat: implement in-flight read deduplication"
```

### Task 3: Implement Redis Batching

**Files:**
- Modify: `backend/lib/redis.ts`
- Create: `backend/test-redis-batch.ts`

- [ ] **Step 1: Write test harness**

```typescript
// backend/test-redis-batch.ts
import { batchGet, batchSet, batchDelete } from './lib/redis';

async function run() {
  console.log(batchGet ? 'batchGet exists' : 'missing');
}
run();
```

- [ ] **Step 2: Implement Redis batch helpers**

Add to `backend/lib/redis.ts`:

```typescript
// Add these exports at the bottom of backend/lib/redis.ts

export interface BatchResult {
  successfulKeys: string[];
  failedKeys: string[];
  errors: Error[];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export async function batchGet<T>(keys: string[]): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  
  const chunks = chunkArray(keys, 100);
  const results: (T | null)[] = [];
  
  // Max 3 concurrent chunks
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    const chunkPromises = batch.map(async (chunk) => {
      const p = redis.pipeline();
      chunk.forEach(k => p.get(k));
      const res = await p.exec();
      
      // Upstash pipeline.exec() returns results directly, but throws if the whole request fails.
      // If a specific command failed, we must manually inspect it (Upstash returns an error object in the array for that slot)
      for (let j = 0; j < res.length; j++) {
        if (res[j] && typeof res[j] === 'object' && 'error' in (res[j] as any)) {
          throw new Error(`Chunk error on get: ${(res[j] as any).error}`);
        }
      }
      return res as (T | null)[];
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    chunkResults.forEach(cr => results.push(...cr));
  }
  
  return results;
}

export async function batchSet(entries: {key: string, value: any, ttlSeconds?: number}[]): Promise<BatchResult> {
  const result: BatchResult = { successfulKeys: [], failedKeys: [], errors: [] };
  if (entries.length === 0) return result;

  const chunks = chunkArray(entries, 100);
  
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    await Promise.all(batch.map(async (chunk) => {
      const p = redis.pipeline();
      chunk.forEach(e => {
        if (e.ttlSeconds !== undefined) {
          p.set(e.key, e.value, { ex: e.ttlSeconds });
        } else {
          p.set(e.key, e.value);
        }
      });
      
      try {
        const res = await p.exec();
        chunk.forEach((e, idx) => {
          if (res[idx] && typeof res[idx] === 'object' && 'error' in (res[idx] as any)) {
            result.failedKeys.push(e.key);
            result.errors.push(new Error(`Set failed for ${e.key}`));
          } else {
            result.successfulKeys.push(e.key);
          }
        });
      } catch (err: any) {
        chunk.forEach(e => result.failedKeys.push(e.key));
        result.errors.push(err);
      }
    }));
  }
  
  return result;
}

export async function batchDelete(keys: string[]): Promise<BatchResult> {
  const result: BatchResult = { successfulKeys: [], failedKeys: [], errors: [] };
  if (keys.length === 0) return result;

  const chunks = chunkArray(keys, 100);
  
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    await Promise.all(batch.map(async (chunk) => {
      const p = redis.pipeline();
      chunk.forEach(k => p.del(k));
      
      try {
        const res = await p.exec();
        chunk.forEach((k, idx) => {
          if (res[idx] && typeof res[idx] === 'object' && 'error' in (res[idx] as any)) {
            result.failedKeys.push(k);
            result.errors.push(new Error(`Del failed for ${k}`));
          } else {
            result.successfulKeys.push(k);
          }
        });
      } catch (err: any) {
        chunk.forEach(k => result.failedKeys.push(k));
        result.errors.push(err);
      }
    }));
  }
  
  return result;
}
```

- [ ] **Step 3: Run test**

Run: `npx tsx backend/test-redis-batch.ts`
Expected: `batchGet exists`

- [ ] **Step 4: Commit**

```bash
git add backend/test-redis-batch.ts backend/lib/redis.ts
git commit -m "feat: implement chunked Redis batching with pipeline error handling"
```
