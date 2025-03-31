import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { hypGenEvalLoop, stopHypGenEvalLoop } from "./anthropic/hypGenEvalLoop";

/**
 * Interfaces
 */
interface Image {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png";
    data: string;
  };
}

export class HypothesisService extends Service {
  static serviceType = "hypothesis";
  capabilityDescription = "Generate and judge hypotheses";
  constructor(protected runtime: IAgentRuntime) {
    super(runtime);
  }
  static async start(runtime: IAgentRuntime) {
    logger.info("*** Starting hypotheses service ***");
    const service = new HypothesisService(runtime);
    const interval = await hypGenEvalLoop(runtime);

    process.on("SIGINT", async () => {
      stopHypGenEvalLoop(interval);
    });

    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info("*** Stopping hypotheses service ***");
    // get the service from the runtime
    const service = runtime.getService(HypothesisService.serviceType);
    if (!service) {
      throw new Error("Hypotheses service not found");
    }
    service.stop();
  }

  async stop() {
    logger.info("*** Stopping hypotheses service instance ***");
  }
}
