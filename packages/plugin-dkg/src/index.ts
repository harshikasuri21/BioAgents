import type { Plugin } from "@elizaos/core";

import { dkgInsert } from "./actions/dkgInsert";
import { generateKaAction } from "./actions/generateKa";

import { graphSearch } from "./providers/graphSearch";

export * as actions from "./actions";
export * as providers from "./providers";

export const dkgPlugin: Plugin = {
    name: "dkg",
    description:
        "Agent DKG which allows you to store memories on the OriginTrail Decentralized Knowledge Graph",
    actions: [dkgInsert, generateKaAction],
    providers: [graphSearch],
};
