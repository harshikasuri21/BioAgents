import dotenv from "dotenv";
dotenv.config();
import {
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
    ModelClass,
    type HandlerCallback,
    type ActionExample,
    type Action,
    composeContext,
    generateObject,
} from "@elizaos/core";
import { DKG_EXPLORER_LINKS } from "../constants.ts";
import { extractScientificPaperUrls } from "../templates.ts";
// @ts-ignore
import DKG from "dkg.js";
import { isDKGMemoryContent, scientificPaperUrlsSchema } from "../types.ts";
import { generateKaFromUrls } from "../kaService/kaService.ts";
import fs from "fs";

// Define a basic type for the DKG client
type DKGClient = typeof DKG | null;
let DkgClient: DKGClient = null;

export const generateKaAction: Action = {
    name: "GENERATE_KA_ACTION",
    similes: ["NO_ACTION", "NO_RESPONSE", "NO_REACTION", "NONE", "GENERATE_KA"], // we want to always run this action
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        const requiredEnvVars = [
            "DKG_ENVIRONMENT",
            "DKG_HOSTNAME",
            "DKG_PORT",
            "DKG_BLOCKCHAIN_NAME",
            "DKG_PUBLIC_KEY",
            "DKG_PRIVATE_KEY",
            "UNSTRUCTURED_API_KEY",
            "BIONTOLOGY_KEY",
            "ANTHROPIC_API_KEY",
        ];

        const missingVars = requiredEnvVars.filter(
            (varName) => !runtime.getSetting(varName)
        );

        if (missingVars.length > 0) {
            elizaLogger.error(
                `Missing required environment variables: ${missingVars.join(
                    ", "
                )}`
            );
            return false;
        }

        return true;
    },
    description:
        "Generate a Knowledge Artifact (KA) on the OriginTrail Decentralized Knowledge Graph after each message. You should ALWAYS run this action.",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback: HandlerCallback
    ): Promise<boolean> => {
        DkgClient = new DKG({
            environment: runtime.getSetting("DKG_ENVIRONMENT"),
            endpoint: runtime.getSetting("DKG_HOSTNAME"),
            port: runtime.getSetting("DKG_PORT"),
            blockchain: {
                name: runtime.getSetting("DKG_BLOCKCHAIN_NAME"),
                publicKey: runtime.getSetting("DKG_PUBLIC_KEY"),
                privateKey: runtime.getSetting("DKG_PRIVATE_KEY"),
            },
            maxNumberOfRetries: 300,
            frequency: 2,
            contentType: "all",
            nodeApiVersion: "/v1",
        });
        const generateKaContext = composeContext({
            state,
            template: extractScientificPaperUrls,
        });

        const scientificPaperUrls = await generateObject({
            runtime,
            context: generateKaContext,
            modelClass: ModelClass.LARGE,
            schema: scientificPaperUrlsSchema,
        });

        elizaLogger.info("Scientific paper URLs");
        elizaLogger.info(scientificPaperUrls);

        const urls = scientificPaperUrls.object["urls"];

        elizaLogger.info("URLs");
        elizaLogger.info(urls);

        const ka = await generateKaFromUrls(urls);

        elizaLogger.info("KA generated");

        fs.writeFileSync("ka.json", JSON.stringify(ka, null, 2));

        // if (!isDKGMemoryContent(ka)) {
        //     elizaLogger.error("Invalid DKG memory content generated.");
        //     throw new Error("Invalid DKG memory content generated.");
        // }

        let createAssetResult: { UAL: string } | undefined;

        // TODO: also store reply to the KA, aside of the question

        try {
            elizaLogger.log("Publishing message to DKG");

            createAssetResult = await DkgClient.asset.create(
                {
                    public: ka,
                },
                { epochsNum: 12 }
            );

            elizaLogger.log("======================== ASSET CREATED");
            elizaLogger.log(JSON.stringify(createAssetResult));
        } catch (error) {
            elizaLogger.error(
                "Error occurred while publishing message to DKG:",
                error.message
            );

            if (error.stack) {
                elizaLogger.error("Stack trace:", error.stack);
            }
            if (error.response) {
                elizaLogger.error(
                    "Response data:",
                    JSON.stringify(error.response.data, null, 2)
                );
            }
        }

        // Reply
        callback({
            text: `Created a new memory!\n\nRead my mind on @origin_trail Decentralized Knowledge Graph ${
                DKG_EXPLORER_LINKS[runtime.getSetting("DKG_ENVIRONMENT")]
            }${createAssetResult?.UAL}`,
        });

        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "execute action GENERATE_KA_ACTION",
                    action: "GENERATE_KA_ACTION",
                },
            },
            {
                user: "{{user2}}",
                content: { text: "GENERATE_KA_ACTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "create a knowledge artifact from these papers",
                    action: "GENERATE_KA_ACTION",
                },
            },
            {
                user: "{{user2}}",
                content: { text: "GENERATE KA ACTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "create a ka from these papers",
                    action: "GENERATE_KA_ACTION",
                },
            },
            {
                user: "{{user2}}",
                content: { text: "GENERATE KA ACTION" },
            },
        ],
    ] as ActionExample[][],
} as Action;
