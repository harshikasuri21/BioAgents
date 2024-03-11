import {
    Evaluator,
    IAgentRuntime,
    Memory,
    EvaluationExample,
    elizaLogger,
} from "@elizaos/core";

export const dkgEvaluator: Evaluator = {
    name: "EVALUATE_DKG_ACTION",
    similes: ["EVALUATE_DKG", "EVALUATE_DKG_ACTION"],
    description: "Evaluate the quality of the DKG",
    examples: [],
    validate: async (
        runtime: IAgentRuntime,
        message: Memory
    ): Promise<boolean> => {
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory): Promise<any> => {
        elizaLogger.info("DKG Evaluator");
    },
};
