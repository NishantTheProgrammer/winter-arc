import { ChatOllama } from "@langchain/ollama";
import { AgentState } from "../state";
import * as fs from "fs";
import * as path from "path";

// Load DSA hierarchy for approach mapping
const hierarchyPath = path.join(__dirname, "..", "hierarchy.json");
let hierarchy = {};
try {
  hierarchy = JSON.parse(fs.readFileSync(hierarchyPath, "utf-8"));
} catch (e) {
  console.error("Could not load hierarchy.json in analyzeCodeNode", e);
}

// Pre-compute all canonical leaf paths from hierarchy.json (nodes mapping to [])
const validLeafPaths: string[] = [];
function extractLeaves(obj: Record<string, any>, prefix = "") {
  for (const [key, val] of Object.entries(obj)) {
    const current = prefix ? `${prefix} > ${key}` : key;
    if (Array.isArray(val) && val.length === 0) {
      validLeafPaths.push(current);
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      extractLeaves(val, current);
    }
  }
}
if ((hierarchy as any).DSA) {
  extractLeaves((hierarchy as any).DSA);
}
const validLeafPathsSet = new Set(validLeafPaths);

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
  keepAlive: "30m",
  numCtx: 4096,
});

// Helper to strip HTML bloat while preserving full problem text and critical Constraints
export function cleanQuestionContext(context: string): string {
  if (!context) return 'No description available';

  const constraintsMatch = context.match(/(?:<strong>)?Constraints:(?:<\/strong>)?[\s\S]*?(?:<\/ul>|$)/i);

  const cleaned = context
    .replace(/<pre>[\s\S]*?<\/pre>/gi, (m) => m.replace(/<[^>]+>/g, ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (constraintsMatch && !cleaned.toLowerCase().includes('constraints:')) {
    const cleanedConstraints = constraintsMatch[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return `${cleaned.substring(0, 2500)}\n\nConstraints: ${cleanedConstraints}`;
  }

  return cleaned.substring(0, 3000);
}

export const analyzeCodeNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  const cleanedProblemContext = cleanQuestionContext(state.questionContext);

  const prompt = `
    You are an expert DSA & Competitive Programming evaluator analyzing an accepted LeetCode submission.
    Evaluate the submitted code strictly and objectively against the THEORETICAL OPTIMAL solution for this problem under the given problem constraints.

    CRITICAL EVALUATION & ANTI-HALLUCINATION RULES:
    1. CONSTRAINT-AWARE COMPLEXITY DERIVATION:
       - Always examine the input constraints to determine the expected optimal time complexity:
         * N <= 10 -> O(N!) or O(2^N * N)
         * N <= 20 -> O(2^N)
         * N <= 100 -> O(N^3) or O(N^2) is standard and optimal
         * N <= 2,000 -> O(N^2)
         * N <= 200,000 -> O(N log N) or O(N)
         * N >= 10^9 -> O(sqrt(N)), O(log N), or O(1)
       - Do NOT assume O(N) is always possible. Many problems have higher theoretical lower bounds (e.g. O(N^2), O(N log N), O(N * K)).
       - If the submitted code achieves the theoretical optimal complexity for this problem under the given constraints, award 9-10 for timeComplexityScore.

    2. STRICT ALGORITHMIC PREREQUISITES (NEVER HALLUCINATE IMPOSSIBLE SHORTCUTS):
       - Never recommend an algorithmic technique unless its strict mathematical prerequisites are satisfied:
         * Sliding Window / Two Pointers: Strictly requires MONOTONICITY (expanding/shrinking a contiguous window predictably). It CANNOT be used to evaluate or sum over all subarrays if the property is non-monotonic.
         * Binary Search: Strictly requires a sorted array or a monotonic search predicate f(x) -> bool.
         * Greedy: Strictly requires the greedy-choice property and optimal substructure.
       - Never claim a faster solution exists unless you can name the exact valid algorithm and explain why it mathematically applies.

    3. OBJECTIVE SCORING (NO GRADE INFLATION, BUT NO UNFAIR PENALTIES):
       - If a solution is optimal for the given problem constraints, award 9-10 in efficiency.
       - If a genuinely faster asymptotic algorithm exists (e.g. O(N^2) submitted when a known O(N) or O(N log N) algorithm solves the problem under large N), penalize timeComplexityScore accordingly (4-6).
       - LeetCode submissions do not need comments or input validation. NEVER deduct points for a lack of comments, docstrings, or parameter null-checks.

    SCORING ANCHORS (1 - 10):
    1. timeComplexityScore (out of 10):
       - 10: Theoretical optimal Big-O for this problem under its constraints with minimal constant factor overhead.
       - 8-9: Matches the optimal/intended Big-O for the given constraints, with minor constant factor overhead.
       - 6-7: Near-optimal Big-O (e.g. O(N log N) when an O(N) exists, or O(N^2) when an O(N log N) exists for large N).
       - 4-5: Sub-optimal Big-O that barely passed test cases (e.g. O(N^2) when N >= 10^5 and an O(N) or O(N log N) algorithm exists).
       - 1-3: Naive brute force or exponential recursion without memoization.

    2. spaceComplexityScore (out of 10):
       - 10: Optimal auxiliary space for this problem (O(1) if in-place is feasible, or minimal unavoidable auxiliary space).
       - 8-9: Minimal auxiliary space necessary (e.g. O(N) where extra memory cannot be avoided).
       - 6-7: Uses extra auxiliary memory (e.g. O(N) when O(1) in-place is possible).
       - 4-5: Unnecessary deep copies or redundant auxiliary structures.
       - 1-3: Memory limit edge / highly wasteful allocation.

    3. readabilityScore (out of 10):
       - 9-10: Self-documenting, meaningful variable names, intuitive structure, clean indentation.
       - 6-8: Mostly readable, but uses obscure or single-letter variable names or unnecessarily cryptic logic.
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
       - 6-8: Relies on ad-hoc, tacked-on 'if' statements to patch edge cases.
       - 1-5: Fragile boundary conditions, barely skirted past constraints.

    7. errorHandlingScore (out of 10):
       - 9-10: Flawless loop bounds, safe index accesses, no risk of off-by-one or integer overflow.
       - 6-8: Minor risk of off-by-one or sloppy index bounds that happened to pass LeetCode test cases.
       - 1-5: Extremely hazardous indexing or state mutation.

    ALGORITHMIC APPROACH MAPPING RULES:
    1. Identify the exact DSA approaches/techniques used in the submitted code.
    2. Every approach MUST be chosen strictly from the LEAF level in the DSA hierarchy.
    3. Do NOT stop at parent or intermediate categories.
    4. Only identify techniques that are ACTUALLY implemented. Return between 1 and 3 precise leaf approaches.

    ==== PROBLEM CONTEXT ====
    ${cleanedProblemContext}

    ==== SUBMITTED CODE (${state.lang}) ====
    ${state.code}

    ==== DSA HIERARCHY ====
    ${JSON.stringify(hierarchy)}

    Output valid JSON strictly in the following format:
    {
      "complexityAnalysis": {
        "problemConstraints": "string",
        "submittedTimeComplexity": "string",
        "submittedSpaceComplexity": "string",
        "optimalTimeComplexity": "string",
        "isOptimalForConstraints": boolean
      },
      "timeComplexityScore": number,
      "spaceComplexityScore": number,
      "readabilityScore": number,
      "maintainabilityScore": number,
      "simplicityScore": number,
      "edgeCasesScore": number,
      "errorHandlingScore": number,
      "approachesUsed": [
        "TopDomain > SubTopic > LeafTechnique"
      ],
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
      const firstBrace = rawContent.indexOf("{");
      const lastBrace = rawContent.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
        parsed = JSON.parse(rawContent.substring(firstBrace, lastBrace + 1));
      } else {
        parsed = JSON.parse(rawContent);
      }
    }

    // Validate and resolve approaches against canonical hierarchy leaf paths
    const rawList: string[] = Array.isArray(parsed.approachesUsed) ? parsed.approachesUsed : [];
    const validatedApproaches: string[] = [];

    for (const item of rawList) {
      if (typeof item !== "string") continue;
      const normalized = item.includes(" > ")
        ? item.trim()
        : item.replace(/\s*[>\/\->|,]\s*|\s+\-\s+/g, " > ").trim();

      if (validLeafPathsSet.has(normalized)) {
        if (!validatedApproaches.includes(normalized)) {
          validatedApproaches.push(normalized);
        }
      } else {
        // Fallback: match by full path, leaf name, or fuzzy inclusion
        const segments = normalized.split(" > ").map((s: string) => s.trim());
        const leafName = segments[segments.length - 1];

        const matchingLeaf = validLeafPaths.find((leaf) =>
          leaf === normalized ||
          leaf.endsWith(" > " + leafName) ||
          leaf.toLowerCase() === normalized.toLowerCase() ||
          leaf.toLowerCase().endsWith(" > " + leafName.toLowerCase()) ||
          leaf.toLowerCase().includes(leafName.toLowerCase())
        );
        if (matchingLeaf && !validatedApproaches.includes(matchingLeaf)) {
          validatedApproaches.push(matchingLeaf);
        }
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
      approachesUsed: validatedApproaches,
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
      approachesUsed: [],
      feedback: "Failed to analyze code.",
    };
  }
};
