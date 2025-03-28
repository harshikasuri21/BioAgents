import { logger, IAgentRuntime } from "@elizaos/core";
import { generateHypothesis } from "./generateHypothesis";
import { sendEvaluationToDiscord } from "./evaluateHypothesis";
export const hypGenEvalLoop = (agentRuntime: IAgentRuntime) => {
  logger.info("Starting hypothesis generation interval");
  const interval = setInterval(async () => {
    const { hypothesis, hypothesisMessageId } =
      await generateHypothesis(agentRuntime);
    await sendEvaluationToDiscord(
      agentRuntime,
      hypothesis,
      hypothesisMessageId
    );
  }, 150000);
  return interval;
};

export const stopHypGenEvalLoop = (interval: NodeJS.Timeout) => {
  logger.info("Stopping hypothesis generation interval");
  clearInterval(interval);
};
