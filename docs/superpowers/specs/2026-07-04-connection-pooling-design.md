# Connection Pooling & Efficiency Design

This document details the implementation of in-flight read deduplication and Redis batching for the `@taikaix/backend`.

## 1. In-Flight Read Deduplication (`dedupRead`)

**Goal:** Collapse concurrent reads (within the same serverless instance) into a single underlying network request.
**Location:** `backend/lib/dedupe.ts`

### API & Scope
- **Scope:** Single-process concurrency collapsing. This is not a distributed lock.
- **Contract:** Side-effect-free reads only.
- **Factory Pattern:** `export function createDeduper(namespace: string)`
  - *Constraint:* The factory memoizes the namespaces internally using a global `Map<string, Deduper>`. If a caller requests a namespace that already exists, it returns the existing instance to prevent multiple maps silently breaking deduplication.
- **Usage:**
  ```typescript
  const userDedup = createDeduper('users');
  return userDedup.run('123', async (signal) => { /* fetch user */ });
  ```

### Failure Semantics & Edge Cases
- **Timeouts & Cancellation:** Every tracked promise is wrapped in a hard timeout (default 10s). The `run` callback receives an `AbortSignal`. If the timeout fires:
  - The map entry is instantly evicted.
  - **ALL current waiters** on that key receive the identical `TimeoutError` (not just the caller whose clock ran out).
  - The `AbortSignal` is triggered to cancel the underlying network request. Note: **Abort is opt-in**; if the underlying `fn()` does not wire up the signal, the "cancelled" request will keep running invisibly in the background.
- **Transient Failures:** If the inner `fn()` rejects, the tracked promise is removed from the `Map` in the `.catch()` block *before* propagating the error. This ensures a fresh retry by subsequent callers.
- **Race Conditions:** Cleanup (map eviction) is handled synchronously to avoid tick-boundary races.
- **Map Size Bounding:** For safety, the internal map will hard-cap at 10,000 keys. If exceeded, new callers bypass deduplication directly rather than OOM-ing the process. This limit hit **must be explicitly logged** as a warning (`console.warn`), because silent degradation under load kills visibility.

## 2. Upstash Redis Batching

**Goal:** Reduce round-trips to Redis by safely exposing `@upstash/redis` pipeline APIs with chunking and strict error handling.
**Location:** `backend/lib/redis.ts`

### API
- `batchGet<T>(keys: string[]): Promise<(T | null)[]>`
- `batchSet(entries: {key: string, value: any, ttlSeconds?: number}[]): Promise<BatchResult>`
- `batchDelete(keys: string[]): Promise<BatchResult>`

### Execution & Limits
- **Chunking:** Requests are chunked into batches of 100 to stay under Upstash payload/execution limits. **All chunks are executed**, regardless of whether an earlier chunk fails (we maximize useful results rather than fail-fast).
- **Concurrency:** Chunks are executed with bounded concurrency (e.g., max 3 in-flight chunks at once using `p-limit` or equivalent logic) to avoid rate limits or throttling errors.

### Failure Semantics & Edge Cases
- **`batchGet` Contract:** A missing key and a failed chunk are strictly distinguished. Since GETs are safe to retry, `batchGet` will throw an error on any chunk-level failure rather than collapsing failures into `null`. `null` exclusively means "key does not exist".
- **`batchSet` / `batchDelete` Contract:** Pipelines are not atomic. A chunked execution returns an aggregated `BatchResult` object: `{ successfulKeys: string[], failedKeys: string[], errors: Error[] }` (Note: no `success` boolean — callers should just check `failedKeys.length === 0`). We do not throw blindly on partial success; callers must inspect `failedKeys` to determine next steps.
- **TTL Handling:** `batchSet` conditionally omits the `ex` property if `ttlSeconds` is undefined to avoid malformed commands.
- **Strict Ordering:** `batchGet` guarantees array index alignment with the input keys.

## 3. Observability & Logging
- **Logging:** Both utilities will log metrics (e.g., dedup hit rate, pipeline batch sizes, capacity warnings). They will use the standard `console.warn` and `console.debug` for visibility.
- **Constraint:** Logs will output the `namespace` and key count, but **will not log raw keys** to avoid exposing PII in logs.
