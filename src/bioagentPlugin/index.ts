import type { Plugin, IAgentRuntime } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { dkgInsert } from "./actions/dkgInsert";
import { HypothesisService } from "./services";
import { initDriveSync } from "./helper";
export * as actions from "./actions";

export const dkgPlugin: Plugin = {
  init: async (config: Record<string, string>, runtime: IAgentRuntime) => {
    logger.info("Initializing dkg plugin");
    logger.info(config);
    setTimeout(async () => {
      await initDriveSync(runtime);
    }, 20000); // prevent undefined error, the db property is not available immediately
  },
  name: "dkg",
  description:
    "Agent DKG which allows you to store memories on the OriginTrail Decentralized Knowledge Graph",
  actions: [dkgInsert],
  providers: [],
  evaluators: [],
  services: [HypothesisService],
  routes: [
    {
      path: "/health",
      type: "GET",
      handler: async (_req: any, res: any) => {
        res.json({
          message: "OK",
        });
      },
    },
  ],
};
