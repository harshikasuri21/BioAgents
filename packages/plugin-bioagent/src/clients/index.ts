import {
    type Client,
    IAgentRuntime,
    type ClientInstance,
    elizaLogger,
} from "@elizaos/core";
import { watchFolderChanges } from "./gdrive";
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

class HypothesisClientManager implements ClientInstance {
    private timerId: NodeJS.Timeout | null = null;

    constructor(private runtime: IAgentRuntime) {
        elizaLogger.info("HypothesisClientManager instantiated");
    }

    async start(): Promise<void> {
        elizaLogger.info("Hypothesis Client Manager started");
    }

    public async stop(): Promise<void> {}
}

export const HypothesisClient: Client = {
    name: "hypothesis",
    start: async (runtime: IAgentRuntime) => {
        const manager = new HypothesisClientManager(runtime);
        // await manager.start();
        // const watcher = watchFolderChanges(runtime).catch(console.error);
        const interval = await hypGenEvalLoop(runtime);
        process.on("SIGINT", async () => {
            // console.log("Stopping file watcher...");
            // if (watcher && typeof watcher.then === "function") {
            //     const watcherInstance = await watcher;
            //     if (
            //         watcherInstance &&
            //         typeof watcherInstance.stop === "function"
            //     ) {
            //         watcherInstance.stop();
            //     }
            // }
            stopHypGenEvalLoop(interval);
        });
        return manager;
    },
};
