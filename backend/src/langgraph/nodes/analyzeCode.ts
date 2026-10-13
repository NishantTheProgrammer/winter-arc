import { ChatOllama } from "@langchain/ollama";
import { AgentState } from "../state";
import * as fs from "fs";

const getOllamaBaseUrl = () => {
  let url = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  if (!fs.existsSync("/.dockerenv") && url.includes("host.docker.internal")) {
    url = url.replace("host.docker.internal", "127.0.0.1");
  }
  return url;
};

const llm = new ChatOllama({
  model: "qwen2.5-coder:14b",
  temperature: 0,
  format: "json",
  baseUrl: getOllamaBaseUrl(),
});

export const analyzeCodeNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  const prompt = `
    You are an expert DSA & Competitive Programming evaluator analyzing an accepted LeetCode submission.
    Evaluate the submitted code strictly and objectively against the THEORETICAL OPTIMAL solution for this problem.

    CRITICAL SCORING RULES:
    - Do NOT grade inflate. A standard or mediocre solution must receive 5 to 6, NOT 8 or 9.
    - Differentiate clearly between naive, acceptable, and truly optimal implementations.
    - LeetCode submissions do not need comments or input validation. NEVER mention or deduct points for a lack of comments, docstrings, or parameter null-checks.

    SCORING ANCHORS (1 - 10):

    1. timeComplexityScore (out of 10):
       - 10: Theoretical optimal Big-O time complexity with minimal constant factor overhead (e.g. O(N) when the lower bound is O(N)).
       - 8-9: Optimal Big-O, but with slight constant factor inefficiencies (e.g. redundant passes or extra map lookups).
       - 6-7: Near-optimal Big-O (e.g. O(N log N) using sorting/heap when an O(N) linear time solution exists, or O(N log K)).
       - 4-5: Sub-optimal Big-O that barely passed test cases (e.g. O(N^2) or O(N * K) when O(N) is standard).
       - 1-3: Naive brute force or exponential recursion without memoization.

    2. spaceComplexityScore (out of 10):
       - 10: Optimal auxiliary space (e.g. O(1) auxiliary space / in-place modifications if feasible).
       - 8-9: Minimal auxiliary space necessary (e.g. O(N) where extra memory cannot be avoided).
       - 6-7: Uses extra auxiliary memory (e.g. O(N) hash map/array when an O(1) two-pointer / in-place approach is possible).
       - 4-5: Unnecessary deep copies, excessive auxiliary buffers, or redundant hash structures.
       - 1-3: Memory limit edge / highly wasteful allocation.

    3. readabilityScore (out of 10):
       - 9-10: Self-documenting, meaningful variable names ('left', 'right', 'currentSum'), intuitive structure, clean indentation.
       - 6-8: Mostly readable, but uses obscure or single-letter variable names ('k1', 'temp2', 'arr3') or unnecessarily cryptic logic.
       - 1-5: Convoluted, obfuscated code, messy layout.

    4. maintainabilityScore (out of 10):
       - 9-10: Clean structure, logical separation of concerns, easy to adapt or debug.
       - 6-8: Monolithic function, mixed concerns, but workable.
       - 1-5: Brittle, tightly coupled, or duplicated logic blocks.

    5. simplicityScore (out of 10):
       - 9-10: Elegant and concise; solves the problem with the minimum necessary complexity without over-engineering.
       - 6-8: Over-engineered with unnecessary helper routines or redundant conditionals.
       - 1-5: Highly convoluted, tangled conditional branching.

    6. edgeCasesScore (out of 10):
       - 9-10: Elegantly handles empty inputs, single-element, duplicates, and extremes naturally through the core algorithm logic.
       - 6-8: Relies on ad-hoc, tacked-on 'if' statements at the top to patch edge cases rather than handling them gracefully in the algorithm.
       - 1-5: Fragile boundary conditions, barely skirted past constraints.

    7. errorHandlingScore (out of 10):
       - 9-10: Flawless loop bounds, safe index accesses, no risk of off-by-one or integer overflow.
       - 6-8: Minor risk of off-by-one or sloppy index bounds that happened to pass LeetCode test cases.
       - 1-5: Extremely hazardous indexing or state mutation.

    Provide concise feedback highlighting:
    1. The actual Time and Space Big-O of this submission vs the theoretical optimal Big-O.
    2. Concrete suggestions to improve time, space, or elegance.

    ==== PROBLEM CONTEXT ====
    ${state.questionContext.substring(0, 1500)} // Truncated to avoid token limits if too long

    ==== SUBMITTED CODE (${state.lang}) ====
    ${state.code}

    Output valid JSON strictly in the following format:
    {
      "timeComplexityScore": number,
      "spaceComplexityScore": number,
      "readabilityScore": number,
      "maintainabilityScore": number,
      "simplicityScore": number,
      "edgeCasesScore": number,
      "errorHandlingScore": number,
      "feedback": "string"
    }
  `;

  const response = await llm.invoke(prompt);
  try {
    const rawContent = response.content.toString();
    
    let parsed: any = {};
    const markdownMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
      parsed = JSON.parse(markdownMatch[1]);
    } else {
      const firstBrace = rawContent.indexOf('{');
      const lastBrace = rawContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
        parsed = JSON.parse(rawContent.substring(firstBrace, lastBrace + 1));
      } else {
        parsed = JSON.parse(rawContent);
      }
    }

    return {
      timeComplexityScore: parsed.timeComplexityScore || 0,
      spaceComplexityScore: parsed.spaceComplexityScore || 0,
      readabilityScore: parsed.readabilityScore || 0,
      maintainabilityScore: parsed.maintainabilityScore || 0,
      simplicityScore: parsed.simplicityScore || 0,
      edgeCasesScore: parsed.edgeCasesScore || 0,
      errorHandlingScore: parsed.errorHandlingScore || 0,
      feedback: parsed.feedback || "No feedback provided.",
    };
  } catch (error) {
    console.error("Failed to parse LLM output in analyzeCodeNode:", error);
    return {
      timeComplexityScore: 0,
      spaceComplexityScore: 0,
      readabilityScore: 0,
      maintainabilityScore: 0,
      simplicityScore: 0,
      edgeCasesScore: 0,
      errorHandlingScore: 0,
      feedback: "Failed to analyze code.",
    };
  }
};
