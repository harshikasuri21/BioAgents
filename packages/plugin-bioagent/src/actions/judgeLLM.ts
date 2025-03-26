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
import { createDKGMemoryTemplate } from "../templates.ts";
// @ts-ignore
import { DKGMemorySchema } from "../types.ts";
import { evaluateHypothesis } from "../judgeLLM/evaluateHypothesis.ts";

export const judgeLLM: Action = {
    name: "JUDGE_LLM",
    similes: [
        "NO_ACTION",
        "NO_RESPONSE",
        "NO_REACTION",
        "NONE",
        "JUDGE_LLM_ACTION",
    ],
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        const requiredEnvVars = [
            "DKG_ENVIRONMENT",
            "DKG_HOSTNAME",
            "DKG_PORT",
            "DKG_BLOCKCHAIN_NAME",
            "DKG_PUBLIC_KEY",
            "DKG_PRIVATE_KEY",
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
        "Judge the quality of the LLM response and give it a score between 0 and 10",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback: HandlerCallback
    ): Promise<boolean> => {
        const createDKGMemoryContext = composeContext({
            state,
            template: createDKGMemoryTemplate,
        });

        const memoryKnowledgeGraph = await generateObject({
            runtime,
            context: createDKGMemoryContext,
            modelClass: ModelClass.LARGE,
            schema: DKGMemorySchema,
        });
        let score = "";
        try {
            // Get the latest user message (not from the agent)
            const latestUserMessage = state.recentMessagesData
                .filter((memory) => memory.userId !== state.agentId)
                .pop();

            if (latestUserMessage) {
                const latestUserText = latestUserMessage.content.text;
                elizaLogger.info(`Latest user message: ${latestUserText}`);

                score = await evaluateHypothesis(latestUserText);
                elizaLogger.info(`Score: ${score}`);
            }
            // elizaLogger.info(
            //     `Recent message data: ${JSON.stringify(
            //         state.recentMessagesData,
            //         null,
            //         2
            //     )}`
            // );
        } catch (error) {
            elizaLogger.error(`Error: ${error}`);
        }

        // Reply
        callback({
            text: `Score: ${score}`,
        });

        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "execute action JUDGE_LLM",
                    action: "JUDGE_LLM",
                },
            },
            {
                user: "{{user2}}",
                content: { text: "Fact checked the statement for accuracy." },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Judge this hypothesis and score it",
                    action: "JUDGE_LLM",
                },
            },
            {
                user: "{{user2}}",
                content: { text: "Fact checked the statement for accuracy." },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "score this hypothesis", action: "JUDGE_LLM" },
            },
            {
                user: "{{user2}}",
                content: { text: "Score: 10" },
            },
        ],
    ] as ActionExample[][],
} as Action;
