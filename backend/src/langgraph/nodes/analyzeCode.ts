import { ChatOllama } from "@langchain/ollama";
import { AgentState } from "../state";

const llm = new ChatOllama({
  model: "llama3.2",
  temperature: 0,
  baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
});

export const analyzeCodeNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  const prompt = `
    Analyze the following code for Time Complexity, Space Complexity, and Readability.
    Provide a score out of 10 for each.
    Provide a concise feedback string explaining the scores.

    Code (${state.lang}):
    ${state.code}

    Output valid JSON strictly in the following format:
    {
      "timeComplexityScore": number,
      "spaceComplexityScore": number,
      "readabilityScore": number,
      "feedback": "string"
    }
  `;

  const response = await llm.invoke(prompt);
  try {
    const rawContent = response.content.toString();
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawContent);

    return {
      timeComplexityScore: parsed.timeComplexityScore || 0,
      spaceComplexityScore: parsed.spaceComplexityScore || 0,
      readabilityScore: parsed.readabilityScore || 0,
      feedback: parsed.feedback || "No feedback provided.",
    };
  } catch (error) {
    console.error("Failed to parse LLM output in analyzeCodeNode:", error);
    return {
      timeComplexityScore: 0,
      spaceComplexityScore: 0,
      readabilityScore: 0,
      feedback: "Failed to analyze code.",
    };
  }
};
