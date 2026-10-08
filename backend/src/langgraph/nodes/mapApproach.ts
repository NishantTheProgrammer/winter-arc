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

const llm = new ChatOllama({
  model: "llama3.2",
  temperature: 0,
  format: "json",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
});

export const mapApproachNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  const prompt = `
    Analyze the following code and map the approach used to the provided DSA hierarchy.
    Provide an array of strings representing the path(s) in the hierarchy that match the approach.
    For example: ["DSA", "Two Pointers", "Sliding Window", "Fixed Size"]

    Hierarchy:
    ${JSON.stringify(hierarchy)}

    Code (${state.lang}):
    ${state.code}

    Output valid JSON strictly in the following format:
    {
      "approachesUsed": [
        "Path string 1",
        "Path string 2"
      ]
    }
  `;

  const response = await llm.invoke(prompt);
  try {
    const rawContent = response.content.toString();
    
    let parsed: any = {};
    const markdownMatch = rawContent.match(/```(?:json)?\\s*([\\s\\S]*?)\\s*```/);
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
      approachesUsed: parsed.approachesUsed || [],
    };
  } catch (error) {
    console.error("Failed to parse LLM output in mapApproachNode:", error);
    return {
      approachesUsed: [],
    };
  }
};
