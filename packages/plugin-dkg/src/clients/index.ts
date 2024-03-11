import {
    type Client,
    IAgentRuntime,
    type ClientInstance,
    elizaLogger,
    type UUID,
} from "@elizaos/core";
import { readdirSync, existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";
import { HypothesisEvaluator } from "./evaluateHypothesis";
import Anthropic from "@anthropic-ai/sdk";
import { fromPath } from "pdf2pic";

/**
 * Interfaces
 */
interface BixbenchPaper {
    uuid: UUID;
    short_id: string;
    hypothesis: string;
    result: string;
    answer: boolean;
    pdfPath: string;
    status: "pending" | "evaluating" | "evaluated";
    evaluation?: string;
    createdAt: number;
    updatedAt: number;
    images: Image[];
}

interface Image {
    type: "image";
    source: {
        type: "base64";
        media_type: "image/png";
        data: string;
    };
}

/**
 * (Optional) Kept for reference if you still need Hypothesis type somewhere else
 */
interface Hypothesis {
    id: UUID;
    pdfPath: string;
    pdfName: string;
    hypothesis: string;
    status: "pending" | "evaluating" | "evaluated";
    evaluation?: string;
    createdAt: number;
    updatedAt: number;
}

class HypothesisClientManager implements ClientInstance {
    private timerId: NodeJS.Timeout | null = null;
    private isRunning = false;
    private anthropic: Anthropic;
    private evaluator: HypothesisEvaluator;

    /**
     * Where we keep our BixbenchPaper objects in memory.
     * Keyed by `short_id` (i.e., filename minus .pdf) for easy lookup.
     */
    private bixbenchPapers: Record<string, BixbenchPaper> = {};

    private bixbenchPath: string;

    constructor(private runtime: IAgentRuntime) {
        elizaLogger.info("HypothesisClientManager instantiated");
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY!,
        });
        this.evaluator = new HypothesisEvaluator();

        // Adjust this path as needed
        this.bixbenchPath = "/home/hackerboy/ai/eliza/bixbench/";
    }

    async start(): Promise<void> {
        this.isRunning = true;
        await this.loadExistingPdfs();

        // If you’d like to re-enable periodic checks, un-comment or revise:
        const processPdfsLoop = () => {
            if (!this.isRunning) return;
            this.processPendingPdfs().catch((err) =>
                elizaLogger.error(`Error processing PDFs: ${err}`)
            );
            this.timerId = setTimeout(processPdfsLoop, 30000); // 30s
        };
        processPdfsLoop();

        const evaluateHypothesesLoop = () => {
            if (!this.isRunning) return;
            this.evaluatePendingHypotheses().catch((err) =>
                elizaLogger.error(`Error evaluating hypotheses: ${err}`)
            );
            this.timerId = setTimeout(evaluateHypothesesLoop, 15000); // 15s
        };
        evaluateHypothesesLoop();

        elizaLogger.info("Hypothesis Client Manager started");
    }

    /**
     * Load existing PDFs from the bixbench folder.
     * We convert them to images so they can be used by Anthropic
     * to generate hypotheses on demand.
     */
    private async loadExistingPdfs(): Promise<void> {
        try {
            if (!existsSync(this.bixbenchPath)) {
                elizaLogger.warn(
                    `Bixbench folder not found at ${this.bixbenchPath}`
                );
                return;
            }

            const files = readdirSync(this.bixbenchPath);
            const pdfFiles = files.filter((file) => file.endsWith(".pdf"));

            elizaLogger.info(
                `Found ${pdfFiles.length} PDF files in bixbench folder`
            );

            for (const pdfFile of pdfFiles) {
                const pdfPath = join(this.bixbenchPath, pdfFile);

                // Skip if we’ve already loaded a BixbenchPaper for this PDF
                const shortId = pdfFile.replace(".pdf", "");
                if (this.bixbenchPapers[shortId]) {
                    continue;
                }

                try {
                    // Convert PDF to images
                    const options = {
                        density: 100,
                        saveFilename: "untitled",
                        savePath: "./scripts/judge/images",
                        format: "png",
                        width: 595,
                        height: 842,
                    };

                    const convert = fromPath(pdfPath, options);
                    const storeHandler = await convert.bulk(-1, {
                        responseType: "base64",
                    });

                    const images = storeHandler
                        .filter((page) => page.base64)
                        .map((page) => ({
                            type: "image" as const,
                            source: {
                                type: "base64" as const,
                                media_type: "image/png" as const,
                                data: page.base64!,
                            },
                        }));

                    // Construct a new BixbenchPaper
                    const paper: BixbenchPaper = {
                        uuid: crypto.randomUUID() as UUID,
                        short_id: shortId,
                        hypothesis: "",
                        result: "",
                        answer: false,
                        pdfPath,
                        status: "pending",
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        images,
                    };

                    // Store in our in-memory dictionary
                    this.bixbenchPapers[shortId] = paper;
                    elizaLogger.info(
                        `Loaded PDF ${pdfFile} into BixbenchPaper`
                    );
                } catch (error) {
                    elizaLogger.error(
                        `Error adding PDF ${pdfFile} to knowledge base: ${error}`
                    );
                }
            }
        } catch (error) {
            elizaLogger.error(`Error loading existing PDFs: ${error}`);
        }
    }

    /**
     * Process any "pending" BixbenchPaper that lacks a hypothesis.
     * Once we generate a hypothesis, we store it and update its status.
     */
    private async processPendingPdfs(): Promise<void> {
        try {
            // Go through each BixbenchPaper in memory
            for (const shortId in this.bixbenchPapers) {
                const paper = this.bixbenchPapers[shortId];

                // If it's marked 'pending' and there's no hypothesis yet, generate
                if (paper.status === "pending" && !paper.hypothesis) {
                    await this.generateHypothesisFromPaper(paper);
                }
            }
        } catch (error) {
            elizaLogger.error(`Error processing pending PDFs: ${error}`);
        }
    }

    /**
     * Generate a hypothesis for an individual BixbenchPaper by sending
     * its images and a short prompt to Anthropic.
     */
    private async generateHypothesisFromPaper(
        paper: BixbenchPaper
    ): Promise<void> {
        try {
            elizaLogger.info(
                `Generating hypothesis for paper: ${paper.short_id}`
            );

            // We already have the images loaded from loadExistingPdfs
            const imageMessages = paper.images;

            const prompt = `
You are a scientific hypothesis generator. You will be given a scientific paper as images.
Your task is to generate a clear, specific, and testable scientific hypothesis based on the paper's content.

The hypothesis should:
1. Be specific and precise
2. Be testable and falsifiable
3. Align with the evidence presented in the paper
4. Be logically consistent and coherent
5. Have predictive power
6. Be novel or significant

Do not restate the paper's conclusion verbatim, but generate a hypothesis that builds on the paper's findings.
Return ONLY the hypothesis text, without any additional explanation or metadata.
`;

            const response = await this.anthropic.messages.create({
                model: "claude-3-7-sonnet-20250219",
                max_tokens: 1000,
                messages: [
                    {
                        role: "user",
                        content: [
                            // Provide the images first
                            ...imageMessages,
                            // Then the textual prompt
                            {
                                type: "text" as const,
                                text: prompt,
                            },
                        ],
                    },
                ],
            });

            let hypothesisText = "Failed to generate hypothesis";
            if (response.content[0].type === "text") {
                hypothesisText = response.content[0].text.trim();
            }

            // Update our paper object
            paper.hypothesis = hypothesisText;
            paper.status = "pending"; // Or "evaluating," if you want that
            paper.updatedAt = Date.now();

            elizaLogger.info(
                `Generated hypothesis for ${
                    paper.short_id
                }: ${hypothesisText.substring(0, 100)}...`
            );

            // Optionally store in runtime cache
            if (this.runtime.cacheManager) {
                try {
                    await this.runtime.cacheManager.set(
                        `bixbench_paper:${paper.uuid}`,
                        paper
                    );
                } catch (error) {
                    elizaLogger.error(
                        `Error storing updated paper in cache: ${error}`
                    );
                }
            }
        } catch (error) {
            elizaLogger.error(
                `Error generating hypothesis for ${paper.short_id}: ${error}`
            );
        }
    }

    /**
     * Evaluate any pending BixbenchPaper (or keep the old Hypothesis logic if needed).
     * Here, we simply look for an item with status===pending, evaluate, then mark as evaluated.
     */
    private async evaluatePendingHypotheses(): Promise<void> {
        try {
            // You can adapt this for BixbenchPaper if desired
            const paperToEvaluate = Object.values(this.bixbenchPapers).find(
                (p) => p.status === "pending" && p.hypothesis
            );

            if (!paperToEvaluate) {
                return;
            }

            paperToEvaluate.status = "evaluating";
            paperToEvaluate.updatedAt = Date.now();

            elizaLogger.info(
                `Evaluating hypothesis for paper: ${paperToEvaluate.short_id}`
            );

            try {
                const evaluation = await this.evaluator.evaluate(
                    paperToEvaluate.hypothesis
                );
                paperToEvaluate.evaluation = evaluation;
                paperToEvaluate.status = "evaluated";
                paperToEvaluate.updatedAt = Date.now();

                elizaLogger.info(
                    `Evaluated paper: ${paperToEvaluate.short_id}`
                );

                // Store in runtime cache if available
                if (this.runtime.cacheManager) {
                    await this.runtime.cacheManager.set(
                        `bixbench_paper:${paperToEvaluate.uuid}`,
                        paperToEvaluate
                    );
                }
            } catch (err) {
                paperToEvaluate.status = "pending";
                elizaLogger.error(
                    `Error evaluating hypothesis for paper ${paperToEvaluate.short_id}: ${err}`
                );
            }
        } catch (error) {
            elizaLogger.error(`Error in evaluatePendingHypotheses: ${error}`);
        }
    }

    public async stop(): Promise<void> {
        this.isRunning = false;
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
            elizaLogger.info("Hypothesis Client Manager stopped");
        }
    }

    /**
     * Utilities (getters, if desired)
     */
    public getAllPapers(): BixbenchPaper[] {
        return Object.values(this.bixbenchPapers);
    }

    public getPaperByShortId(shortId: string): BixbenchPaper | undefined {
        return this.bixbenchPapers[shortId];
    }
}

export const HypothesisClient: Client = {
    name: "hypothesis",
    start: async (runtime: IAgentRuntime) => {
        const manager = new HypothesisClientManager(runtime);
        await manager.start();
        return manager;
    },
};
