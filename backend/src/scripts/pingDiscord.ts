import * as dotenv from 'dotenv';
dotenv.config();

import { sendDiscordMessage } from '../services/discordClient';

async function main() {
  const customMsg = process.argv.slice(2).join(' ').trim();
  const now = new Date();
  
  // Format IST time
  const istTime = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).format(now);

  const content = customMsg 
    ? `${customMsg} (${istTime} IST)`
    : `hi ${istTime}`;

  console.log(`📡 [Discord Ping] Sending message: "${content}"`);
  const result = await sendDiscordMessage({
    content,
    username: 'Winter Arc Bot',
  });

  if (result.success) {
    console.log(`✅ [Discord Ping] Message sent successfully to Discord!`);
    process.exit(0);
  } else {
    console.error(`❌ [Discord Ping] Failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal ping error:', err);
  process.exit(1);
});
