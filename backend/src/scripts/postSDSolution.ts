import { sendDailySDSolution } from '../services/systemDesignSolutionService';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📐 Winter Arc System Design 6 PM Solution Bot

Usage:
  npx tsx src/scripts/postSDSolution.ts [options]

Options:
  --dry-run           Preview generated architectural solution without posting to Discord
  --force             Force send even if before 6 PM IST or already posted today
  --date YYYY-MM-DD   Specify target date (defaults to current date in IST)
  --help, -h          Show this help message

Behavior:
  - Automatically triggers at/after 6:00 PM IST when solutions unlock.
  - Generates a high-yield, structured system design breakdown using Ollama/LLM & curated resources.
  - Automatically retries on network/rate-limit failures.
  - Idempotent: Skips duplicate posts if already sent today.
    `);
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

  try {
    const res = await sendDailySDSolution({
      dryRun,
      force,
      targetDate: dateArg,
    });

    if (!res.success && res.status !== 'LOCKED' && res.status !== 'DRY_RUN' && res.status !== 'ALREADY_POSTED') {
      console.error(`\n⚠️  SD Solution process ended with status: ${res.status}`);
      process.exit(1);
    }

    process.exit(0);
  } catch (err: any) {
    console.error(`\n❌ Unexpected error: ${err.message || err}`);
    process.exit(1);
  }
}

main();
