import axios, { AxiosError } from 'axios';

export interface SendMessageOptions {
  content?: string;
  embeds?: any[];
  username?: string;
  avatar_url?: string;
  maxRetries?: number;
  initialDelayMs?: number;
}

export interface SendMessageResult {
  success: boolean;
  attempts: number;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Splits long text into chunks <= maxLength (default 1950 chars)
 * respecting double newlines and line breaks to avoid cutting sentences.
 */
export function chunkMessage(text: string, maxLength: number = 1950): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try finding the best split point before maxLength
    let splitIndex = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    const chunk = remaining.substring(0, splitIndex).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

/**
 * Sends a single payload to Discord with automatic retries,
 * exponential backoff, and 429 Rate-Limit handling.
 */
export async function sendPayloadWithRetry(
  url: string,
  payload: Record<string, any>,
  headers: Record<string, string>,
  maxRetries: number = 3,
  initialDelayMs: number = 2000
): Promise<SendMessageResult> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      await axios.post(url, payload, {
        headers,
        timeout: 15000,
      });

      return {
        success: true,
        attempts: attempt,
      };
    } catch (err: any) {
      const isLastAttempt = attempt > maxRetries;
      const axiosError = err as AxiosError;
      const status = axiosError.response?.status;
      const responseData: any = axiosError.response?.data;

      // Handle Discord 429 Rate Limit
      if (status === 429) {
        const retryAfterSec = responseData?.retry_after || 2;
        const waitMs = Math.ceil(retryAfterSec * 1000) + 500;
        console.warn(`[DiscordClient] Rate limited (429). Retrying after ${waitMs}ms (attempt ${attempt}/${maxRetries + 1})...`);
        if (!isLastAttempt) {
          await sleep(waitMs);
          continue;
        }
      }

      const errMsg = responseData ? JSON.stringify(responseData) : err.message;

      // Transient errors: 5xx, network timeouts, connection resets
      const isTransient = !status || status >= 500 || axiosError.code === 'ECONNABORTED' || axiosError.code === 'ECONNRESET';

      if (isTransient && !isLastAttempt) {
        console.warn(`[DiscordClient] Request failed (${errMsg}). Retrying in ${delay}ms (attempt ${attempt}/${maxRetries + 1})...`);
        await sleep(delay);
        delay *= 2; // Exponential backoff
        continue;
      }

      console.error(`[DiscordClient] Failed sending to Discord after ${attempt} attempt(s): ${errMsg}`);
      return {
        success: false,
        attempts: attempt,
        error: errMsg,
      };
    }
  }

  return {
    success: false,
    attempts: attempt,
    error: 'Exceeded maximum retries',
  };
}

/**
 * Universal Discord sender supporting Webhooks and Bot REST API.
 * Automatically chunks content if exceeding Discord's 2000 char limit.
 */
export async function sendDiscordMessage(options: SendMessageOptions): Promise<SendMessageResult> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  const channelId = process.env.DISCORD_CHANNEL_ID?.trim();
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 2000;

  if (!webhookUrl && (!botToken || !channelId)) {
    const errorMsg = 'Discord configuration missing! Set DISCORD_WEBHOOK_URL in backend/.env';
    console.error(`⚠️ [DiscordClient] ${errorMsg}`);
    return {
      success: false,
      attempts: 0,
      error: errorMsg,
    };
  }

  // Determine target URL and headers
  let targetUrl = '';
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (webhookUrl) {
    targetUrl = webhookUrl;
  } else {
    targetUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;
    headers['Authorization'] = `Bot ${botToken}`;
  }

  // If content is longer than 1950 chars, chunk it
  const content = options.content || '';
  const chunks = content ? chunkMessage(content, 1950) : [''];

  let totalAttempts = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const payload: Record<string, any> = {};

    if (chunk) {
      payload.content = chunk;
    }

    // Only attach embeds to the first chunk
    if (i === 0 && options.embeds && options.embeds.length > 0) {
      payload.embeds = options.embeds;
    }

    if (webhookUrl) {
      payload.username = options.username || 'winter-arc';
      payload.avatar_url = options.avatar_url || 'https://assets.leetcode.com/static_assets/public/icons/favicon-192x192.png';
    }

    const res = await sendPayloadWithRetry(targetUrl, payload, headers, maxRetries, initialDelayMs);
    totalAttempts += res.attempts;

    if (!res.success) {
      return {
        success: false,
        attempts: totalAttempts,
        error: res.error,
      };
    }

    // Small delay between multiple chunks
    if (i < chunks.length - 1) {
      await sleep(500);
    }
  }

  return {
    success: true,
    attempts: totalAttempts,
  };
}
