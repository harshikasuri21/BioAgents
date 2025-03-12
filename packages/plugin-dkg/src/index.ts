import type { Plugin } from "@elizaos/core";

import { dkgInsert } from "./actions/dkgInsert";
import { generateKaAction } from "./actions/generateKa";
import { judgeLLM } from "./actions/judgeLLM";
import { graphSearch } from "./providers/graphSearch";
import { HypothesisClient } from "./clients";

export * as actions from "./actions";
export * as providers from "./providers";

export const dkgPlugin: Plugin = {
    name: "dkg",
    description:
        "Agent DKG which allows you to store memories on the OriginTrail Decentralized Knowledge Graph",
    actions: [dkgInsert, generateKaAction, judgeLLM],
    providers: [graphSearch],
    evaluators: [],
    clients: [HypothesisClient],
};
