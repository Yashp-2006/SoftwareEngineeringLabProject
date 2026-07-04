// backend/test-dedupe.ts
import { createDeduper } from './lib/dedupe';

async function runTests() {
  const deduper = createDeduper('test');
  let calls = 0;

  const fn = async (_signal: AbortSignal) => {
    calls++;
    await new Promise(r => setTimeout(r, 100));
    return 'data';
  };

  // Test 1: dedup collapses concurrent calls
  const [res1, res2] = await Promise.all([
    deduper.run('key1', fn),
    deduper.run('key1', fn)
  ]);

  if (calls !== 1) throw new Error(`FAIL: calls should be 1 but was ${calls}`);
  if (res1 !== 'data' || res2 !== 'data') throw new Error('FAIL: incorrect results');
  console.log('✓ Test 1: dedup collapses concurrent calls');

  // Test 2: after resolution, next call is a fresh fetch
  calls = 0;
  await deduper.run('key1', fn);
  if (calls !== 1) throw new Error(`FAIL: second independent call should fire once but was ${calls}`);
  console.log('✓ Test 2: map cleared after resolution, fresh fetch works');

  // Test 3: failure evicts the key so next caller gets a fresh attempt
  calls = 0;
  let errorCount = 0;
  const failFn = async (_signal: AbortSignal): Promise<string> => {
    calls++;
    throw new Error('transient error');
  };

  try {
    await deduper.run('fail-key', failFn);
  } catch {
    errorCount++;
  }
  try {
    await deduper.run('fail-key', failFn);
  } catch {
    errorCount++;
  }

  if (calls !== 2) throw new Error(`FAIL: failure should evict key so next caller retries — got ${calls} calls`);
  if (errorCount !== 2) throw new Error(`FAIL: both callers should see error`);
  console.log('✓ Test 3: transient failure evicts key, next caller retries');

  // Test 4: createDeduper returns same instance for same namespace
  const d1 = createDeduper('ns-singleton');
  const d2 = createDeduper('ns-singleton');
  if (d1 !== d2) throw new Error('FAIL: factory should return singleton per namespace');
  console.log('✓ Test 4: factory returns singleton per namespace');

  console.log('\nAll dedupe tests passed!');
}

runTests().catch(err => {
  console.error(err.message);
  process.exit(1);
});
