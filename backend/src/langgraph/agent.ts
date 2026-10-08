import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { AgentState } from "./state";
import { analyzeCodeNode } from "./nodes/analyzeCode";
import { mapApproachNode } from "./nodes/mapApproach";
import { calculateScoreNode } from "./nodes/calculateScore";

// Define the state graph
const StateAnnotation = Annotation.Root({
  submissionId: Annotation<string>,
  code: Annotation<string>,
  lang: Annotation<string>,
  timeComplexityScore: Annotation<number | null>,
  spaceComplexityScore: Annotation<number | null>,
  readabilityScore: Annotation<number | null>,
  approachesUsed: Annotation<string[]>,
  feedback: Annotation<string>,
  aggregatedScore: Annotation<number | null>,
});

const workflow = new StateGraph(StateAnnotation)
  .addNode("analyzeCode", analyzeCodeNode)
  .addNode("mapApproach", mapApproachNode)
  .addNode("calculateScore", calculateScoreNode)
  .addEdge(START, "analyzeCode")
  .addEdge("analyzeCode", "mapApproach")
  .addEdge("mapApproach", "calculateScore")
  .addEdge("calculateScore", END);

export const agent = workflow.compile();
