import { HypothesisEvaluator } from "./evaluateHypothesis";
import { elizaLogger } from "@elizaos/core";

/**
 * Example of how to use the HypothesisEvaluator class
 */
export async function evaluateScientificHypothesis(
    hypothesis: string
): Promise<string> {
    try {
        // Create a new evaluator instance
        const evaluator = new HypothesisEvaluator();

        // Evaluate the hypothesis
        const evaluationResult = await evaluator.evaluate(hypothesis);

        return evaluationResult;
    } catch (error) {
        elizaLogger.error(`Error evaluating hypothesis: ${error}`);
        throw error;
    }
}

// Example usage:
// async function main() {
//   const hypothesis = "Truncating ASXL1 mutations will lead to specific gene expression changes in blood that reflect alterations in hematological processes, such as T cell and neutrophil activation.";
//   const result = await evaluateScientificHypothesis(hypothesis);
//   console.log(result);
// }
//
// main().catch(console.error);
