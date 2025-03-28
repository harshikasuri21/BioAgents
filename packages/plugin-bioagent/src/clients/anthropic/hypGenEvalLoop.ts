import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { generateHypothesis } from "./generateHypothesis";
import { sendEvaluationToDiscord } from "./evaluateHypothesis";
export const hypGenEvalLoop = (agentRuntime: IAgentRuntime) => {
    elizaLogger.info("Starting hypothesis generation interval");
    const interval = setInterval(async () => {
        const { hypothesis, hypothesisMessageId } = await generateHypothesis(
            agentRuntime
        );
        await sendEvaluationToDiscord(
            agentRuntime,
            hypothesis,
            hypothesisMessageId
        );
    }, 120000);
    return interval;
};

export const stopHypGenEvalLoop = (interval: NodeJS.Timeout) => {
    elizaLogger.info("Stopping hypothesis generation interval");
    clearInterval(interval);
};
