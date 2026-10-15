import { sendDailyAnnouncement } from '../services/discordService';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
❄️ Winter Arc Discord Announcement Bot

Usage:
  npx tsx src/scripts/postDiscordAnnouncement.ts [options]

Options:
  --dry-run       Preview announcement text & embed without sending to Discord
  --force         Force send even if today's announcement was already recorded
  --date YYYY-MM-DD   Specify target date (defaults to current date in IST)
  --format <fmt>  Format type: 'embed' (default), 'plain', or 'both'
  --help, -h      Show this help message

Configuration (backend/.env):
  DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." # Recommended (Webhook)
  - OR -
  DISCORD_BOT_TOKEN="your_bot_token"
  DISCORD_CHANNEL_ID="your_channel_id"
    `);
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  // Parse date
  const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

  // Parse format
  let format: 'embed' | 'plain' | 'both' = 'embed';
  const formatIdx = args.findIndex((a) => a === '--format');
  if (formatIdx !== -1 && args[formatIdx + 1]) {
    const val = args[formatIdx + 1].toLowerCase();
    if (val === 'plain' || val === 'embed' || val === 'both') {
      format = val as any;
    }
  }

  try {
    const res = await sendDailyAnnouncement({
      dryRun,
      force,
      targetDate: dateArg,
      format,
    });

    if (!res.success && res.status !== 'DRY_RUN') {
      console.error(`\n⚠️  Announcement process ended with status: ${res.status}`);
      // If config is missing, exit 0 so cron/launchd doesn't treat it as a hard crash while user hasn't set .env yet
      if (res.status === 'CONFIG_MISSING') {
        process.exit(0);
      }
      process.exit(1);
    }

    process.exit(0);
  } catch (err: any) {
    console.error(`\n❌ Unexpected error: ${err.message || err}`);
    process.exit(1);
  }
}

main();
