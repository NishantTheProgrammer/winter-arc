import { ChatOllama } from "@langchain/ollama";
import { AgentState } from "../state";

const llm = new ChatOllama({
  model: "llama3.2",
  temperature: 0,
  baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
});

export const analyzeCodeNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  const prompt = `
    Analyze the following code across 3 major categories. Provide a score out of 10 for each sub-category:

    1. Algorithmic Efficiency
       - timeComplexityScore (out of 10)
       - spaceComplexityScore (out of 10)
    2. Code Quality
       - readabilityScore (out of 10)
       - maintainabilityScore (out of 10)
       - simplicityScore (out of 10)
    3. Correctness & Robustness
       - edgeCasesScore (out of 10)
       - errorHandlingScore (out of 10)

    Provide a concise feedback string explaining the scores.

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
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawContent);

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
