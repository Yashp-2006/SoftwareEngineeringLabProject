// backend/test-redis-batch.ts
import { batchGet, batchSet, batchDelete } from './lib/redis';

async function run() {
  console.log(batchGet ? 'batchGet exists' : 'missing');
}
run();
