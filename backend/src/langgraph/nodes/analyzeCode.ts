import { ChatOllama } from "@langchain/ollama";
import { AgentState } from "../state";

const llm = new ChatOllama({
  model: "llama3.2",
  temperature: 0,
  format: "json",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
});

export const analyzeCodeNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  const prompt = `
    Analyze the following code across 3 major categories. Provide a score out of 10 for each sub-category:

    1. Algorithmic Efficiency
       - timeComplexityScore (out of 10)
       - spaceComplexityScore (out of 10)
    2. Code Quality
       - readabilityScore (out of 10) - CRITICAL: Judge this ONLY on variable naming, structure, and clarity of the logic. DO NOT penalize for lack of comments. Ignore comments completely.
       - maintainabilityScore (out of 10)
       - simplicityScore (out of 10)
    3. Correctness & Robustness
       - edgeCasesScore (out of 10)
       - errorHandlingScore (out of 10)

    Provide a concise feedback string explaining the scores. 
    IMPORTANT RULE: LeetCode submissions do not need comments or input validation. NEVER mention a lack of comments, docstrings, or input validation in your feedback. Do not deduct points for them.

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
