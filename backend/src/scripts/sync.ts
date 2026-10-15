/**
 * sync.ts
 *
 * Orchestrates the full Winter Arc data sync pipeline:
 * 1. Seed users & new submissions from LeetCode (skips existing unless --force)
 * 2. Fetch code & descriptions for submissions that lack them (skips existing unless --force)
 * 3. Run AI analysis on pending submissions (skips already analyzed unless --force)
 *
 * Usage:
 *   npx tsx src/scripts/sync.ts           # Safe incremental sync (preserves existing data)
 *   npx tsx src/scripts/sync.ts --force   # Force refresh of all submissions and analysis
 */

import { syncQOTD } from './seedQOTD';
import { seedUsers } from './seedUsers';
import { fetchCodesInBatches } from './fetchCodes';
import { runAnalysisBatch } from './analyzePending';

async function main() {
  const isForce = process.argv.includes('--force');

  console.log('================================================================');
  console.log('❄️  WINTER ARC SYNC PIPELINE');
  console.log(`Mode: ${isForce ? '⚠️  FORCE (Overwriting & Re-analyzing)' : '🛡️  INCREMENTAL (Preserving loaded & analyzed data)'}`);
  console.log('================================================================\n');

  try {
    // Step 1: Sync LeetCode Question of the Day challenges & problem statements
    console.log('--- Step 1/4: Syncing Question of the Day ---');
    await syncQOTD(isForce);

    // Step 2: Seed users and new submissions
    console.log('\n--- Step 2/4: Seeding Users & Submissions ---');
    await seedUsers(isForce);

    // Step 3: Fetch missing source codes
    console.log('\n--- Step 3/4: Fetching Source Codes ---');
    await fetchCodesInBatches(isForce);

    // Step 4: Run AI analysis on pending submissions
    console.log('\n--- Step 4/4: Running AI Analysis ---');
    await runAnalysisBatch(isForce);

    console.log('\n================================================================');
    console.log('🎉 Winter Arc Sync Completed Successfully!');
    console.log('================================================================');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Winter Arc Sync Failed:', error.message || error);
    process.exit(1);
  }
}

main();
