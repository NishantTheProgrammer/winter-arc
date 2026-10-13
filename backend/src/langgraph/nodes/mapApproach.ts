import { ChatOllama } from "@langchain/ollama";
import { AgentState } from "../state";
import * as fs from "fs";
import * as path from "path";

const hierarchyPath = path.join(__dirname, "..", "hierarchy.json");
let hierarchy = {};
try {
  hierarchy = JSON.parse(fs.readFileSync(hierarchyPath, "utf-8"));
} catch (e) {
  console.error("Could not load hierarchy.json", e);
}

// Pre-compute all canonical leaf paths from hierarchy.json (nodes mapping to [])
const validLeafPaths: string[] = [];
function extractLeaves(obj: Record<string, any>, prefix = '') {
  for (const [key, val] of Object.entries(obj)) {
    const current = prefix ? `${prefix} > ${key}` : key;
    if (Array.isArray(val) && val.length === 0) {
      validLeafPaths.push(current);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
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
});

export const mapApproachNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  const prompt = `
    Analyze the following code and identify the exact DSA approaches/techniques used.
    Map each approach to a LEAF path in the provided DSA hierarchy.

    CRITICAL RULES:
    1. Every approach MUST be chosen strictly from the LEAF level (the deepest, most nested level where the JSON has an empty array []).
       Do NOT stop at parent or intermediate categories.
       - Valid leaf examples:
         "Two Pointers > Sliding Window > Fixed Size"
         "Stack > Matching"
         "Dynamic Programming > Memoization"
         "Recursion > Direct Recursion"
         "Searching > Binary Search > Exact Match"
         "Hashing > Hash Map"
       - INVALID examples (never output parent categories):
         "Recursion", "Searching", "Binary Search", "Stack", "Dynamic Programming", "Two Pointers"
    2. Only identify techniques that are ACTUALLY and substantially implemented in the submitted code.
       Do NOT invent or hallucinate unused algorithms (e.g. do not output Binary Search if the code uses a Stack).
    3. Start each path from the top-level category (do NOT include "DSA" as the root).
    4. Return between 1 and 3 precise leaf approaches.

    Hierarchy:
    ${JSON.stringify(hierarchy)}

    Code (${state.lang}):
    ${state.code}

    Output valid JSON strictly in this format:
    {
      "approachesUsed": [
        "TopDomain > SubTopic > LeafTechnique"
      ]
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

    const rawList: string[] = Array.isArray(parsed.approachesUsed) ? parsed.approachesUsed : [];
    const validatedApproaches: string[] = [];

    for (const item of rawList) {
      if (typeof item !== 'string') continue;
      const normalized = item.includes(' > ')
        ? item.trim()
        : item.replace(/\s*[>\/\->|,]\s*|\s+\-\s+/g, ' > ').trim();

      if (validLeafPathsSet.has(normalized)) {
        if (!validatedApproaches.includes(normalized)) {
          validatedApproaches.push(normalized);
        }
      } else {
        // Fallback: If model stopped at an intermediate node or slight variation, map to its canonical leaf
        const matchingLeaf = validLeafPaths.find(leaf =>
          leaf === normalized || leaf.startsWith(normalized + ' > ')
        );
        if (matchingLeaf && !validatedApproaches.includes(matchingLeaf)) {
          validatedApproaches.push(matchingLeaf);
        }
      }
    }

    return {
      approachesUsed: validatedApproaches,
    };
  } catch (error) {
    console.error("Failed to parse LLM output in mapApproachNode:", error);
    return {
      approachesUsed: [],
    };
  }
};
