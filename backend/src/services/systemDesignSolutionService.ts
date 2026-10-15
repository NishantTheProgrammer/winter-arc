import axios from 'axios';
import { db } from '../firebase/config';
import {
  getISTDateString,
  getISTDetails,
  isResourcesUnlockedIST,
  getAssignedRecordForDate,
  pickProblemsForDate,
  DailySystemDesignRecord,
  SystemDesignProblem,
} from './systemDesignService';
import { calculateDayNumber } from './discordService';
import { sendDiscordMessage } from './discordClient';
import { ChatOllama } from '@langchain/ollama';

export interface SDSolutionOptions {
  force?: boolean;
  dryRun?: boolean;
  targetDate?: string;
  skipLlm?: boolean;
}

export interface SDSolutionResult {
  success: boolean;
  status: 'POSTED' | 'ALREADY_POSTED' | 'LOCKED' | 'WAITING_FOR_DATA' | 'DRY_RUN' | 'ERROR';
  message: string;
  content?: string;
}

function getOllamaUrl(): string {
  const envUrl = process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434';
  return envUrl;
}

/**
 * Generate high-yield solution breakdown using Ollama (or fallback template)
 */
export async function generateSolutionForProblem(problem: SystemDesignProblem): Promise<string> {
  const prompt = `You are a Principal Distributed Systems Architect.
Provide a concise, practical, high-yield system design solution for:
Problem: ${problem.title} (Difficulty Level: ${problem.difficulty})
Requirements: ${problem.problem_statement}
Tags: ${problem.tags?.join(', ') || 'distributed systems'}

Structure your answer strictly with these 4 sections (use clean markdown bullet points):
1. Core Requirements & API
2. High-Level Architecture & Flow
3. Key Algorithms & Data Models
4. Scaling Bottlenecks & Trade-offs

Keep it direct, technically rigorous, and under 1,400 characters. Avoid conversational intros or generic conclusions.`;

  // Try LLM generation via Ollama
  try {
    const candidateModels = ['llama3.2:latest', 'qwen2.5-coder:14b', 'gemma3:4b'];
    const baseUrl = getOllamaUrl();

    for (const model of candidateModels) {
      try {
        const llm = new ChatOllama({
          model,
          baseUrl,
          temperature: 0.2,
        });

        const res = await Promise.race([
          llm.invoke(prompt),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('LLM generation timed out (30s)')), 30000)),
        ]);

        const text = typeof res.content === 'string' ? res.content.trim() : JSON.stringify(res.content);
        if (text && text.length > 50) {
          return text;
        }
      } catch (err: any) {
        // Try next model if current fails
        continue;
      }
    }
  } catch (err: any) {
    console.warn(`[SDSolution] LLM invocation failed: ${err.message}. Using structured synthesis.`);
  }

  // Graceful structured fallback based on problem tags and resources
  return `1. Core Requirements & API:
• Distributed handling for ${problem.tags?.join(', ') || 'high-throughput'} requests
• Low-latency, high availability, and resilient fault tolerance

2. High-Level Architecture & Flow:
• Client -> API Gateway / Load Balancer -> Service Cluster -> Distributed Cache / Storage
• Stateless application tier with state externalized to in-memory datastores

3. Key Algorithms & Data Models:
• Core algorithm tailored to ${problem.tags?.join(' and ') || 'distributed systems'}
• Sharding / partitioning key: User ID or IP hash with consistent hashing

4. Scaling Bottlenecks & Trade-offs:
• Replication lag vs strong consistency trade-off
• Failover mechanism: Graceful degradation with fallback cache`;
}

/**
 * Format the complete Discord message for one or more system design problems
 */
export function formatSolutionMessage(
  dayNumber: number,
  targetDate: string,
  problem: SystemDesignProblem,
  solutionText: string
): string {
  const resourceLines = (problem.resources || [])
    .slice(0, 4)
    .map((r) => `• ${r.title}: <${r.url}>`)
    .join('\n');

  return `📐 **System Design Solution: ${problem.title} (Day ${dayNumber})**

${solutionText}

📚 **Curated Resources:**
${resourceLines || '• Check dashboard for full reference list.'}`;
}

/**
 * Orchestrates 6 PM solution unlocking, LLM generation, duplicate check, and Discord broadcast
 */
export async function sendDailySDSolution(options: SDSolutionOptions = {}): Promise<SDSolutionResult> {
  const targetDate = options.targetDate || getISTDateString();
  const dayNumber = calculateDayNumber(targetDate);
  const ist = getISTDetails();

  console.log(`\n📐 [SD Solution Bot] Checking 6 PM solution unlock for ${targetDate} (IST hour: ${ist.hour})...`);

  // 1. Time / Unlock Check: 6:00 PM IST (hour >= 18)
  const isUnlocked = isResourcesUnlockedIST(targetDate);
  if (!isUnlocked && !options.force && !options.dryRun) {
    const msg = `System Design solution for ${targetDate} unlocks at 6:00 PM IST (current hour: ${ist.hour}:00 IST). Skipping until 6 PM.`;
    console.log(`⏳ [SD Solution Bot] ${msg}`);
    return {
      success: false,
      status: 'LOCKED',
      message: msg,
    };
  }

  // 2. Duplicate Check
  const solutionRecordRef = db.collection('discord_sd_solutions').doc(targetDate);
  const existingDoc = await solutionRecordRef.get();
  if (existingDoc.exists && !options.force && !options.dryRun) {
    const existing = existingDoc.data();
    const msg = `System Design solution for ${targetDate} was already posted to Discord at ${existing?.postedAt || 'earlier'}. Skipping. Use --force to re-post.`;
    console.log(`ℹ️  [SD Solution Bot] ${msg}`);
    return {
      success: true,
      status: 'ALREADY_POSTED',
      message: msg,
    };
  }

  // 3. Retrieve assigned SD problem for target date
  let sdRecord: DailySystemDesignRecord | null = await getAssignedRecordForDate(targetDate);
  if (!sdRecord) {
    try {
      sdRecord = await pickProblemsForDate(targetDate);
    } catch (err: any) {
      console.warn(`[SD Solution Bot] Could not auto-pick System Design problem: ${err.message}`);
    }
  }

  if (!sdRecord || !sdRecord.problems || sdRecord.problems.length === 0) {
    const msg = `No System Design problem found or assigned for ${targetDate}.`;
    console.warn(`⚠️  [SD Solution Bot] ${msg}`);
    return {
      success: false,
      status: 'WAITING_FOR_DATA',
      message: msg,
    };
  }

  // 4. Generate solutions for problems
  const fullMessages: string[] = [];

  for (const prob of sdRecord.problems) {
    // Check if solution is already cached in Firestore
    const cacheDocId = `${targetDate}_${prob.id}`;
    const cacheDocRef = db.collection('system_design_solutions').doc(cacheDocId);
    const cachedSnap = await cacheDocRef.get();

    let solutionText = '';
    if (cachedSnap.exists && cachedSnap.data()?.solution && !options.force) {
      solutionText = cachedSnap.data()?.solution;
      console.log(`  ⚡ Used cached solution for [#${prob.id} ${prob.title}]`);
    } else {
      console.log(`  🧠 Generating architectural solution for [#${prob.id} ${prob.title}]...`);
      solutionText = await generateSolutionForProblem(prob);
      await cacheDocRef.set({
        date: targetDate,
        problemId: prob.id,
        title: prob.title,
        difficulty: prob.difficulty,
        solution: solutionText,
        generatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    const message = formatSolutionMessage(dayNumber, targetDate, prob, solutionText);
    fullMessages.push(message);
  }

  const combinedContent = fullMessages.join('\n\n---\n\n');

  // 5. Dry run
  if (options.dryRun) {
    console.log('\n--- [DRY RUN SD SOLUTION PREVIEW] ---');
    console.log(combinedContent);
    console.log('-------------------------------------\n');
    return {
      success: true,
      status: 'DRY_RUN',
      message: 'Dry run completed successfully. No request sent to Discord.',
      content: combinedContent,
    };
  }

  // 6. Broadcast to Discord with retries
  console.log(`🚀 [SD Solution Bot] Sending System Design Solution to Discord (with retries)...`);
  for (const msg of fullMessages) {
    const sendRes = await sendDiscordMessage({
      content: msg,
      maxRetries: 3,
      initialDelayMs: 2000,
    });

    if (!sendRes.success) {
      console.error(`❌ [SD Solution Bot] Failed to send solution to Discord: ${sendRes.error}`);
      return {
        success: false,
        status: 'ERROR',
        message: `Failed to deliver solution: ${sendRes.error}`,
      };
    }
  }

  console.log(`✅ [SD Solution Bot] System Design Solution for Day ${dayNumber} (${targetDate}) posted successfully!`);

  // 7. Record in Firestore for idempotency (only on verified success)
  await solutionRecordRef.set({
    date: targetDate,
    dayNumber,
    postedAt: new Date().toISOString(),
    problemTitles: sdRecord.problems.map((p) => p.title),
    problemIds: sdRecord.problems.map((p) => p.id),
  });

  return {
    success: true,
    status: 'POSTED',
    message: 'System Design Solution posted successfully to Discord.',
    content: combinedContent,
  };
}
