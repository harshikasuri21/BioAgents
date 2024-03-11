import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { fromPath } from "pdf2pic";
import { elizaLogger } from "@elizaos/core";
import { bixbenchPapers } from "../judgeLLM/bixbenchPapers";
import { evaluationPrompt } from "../judgeLLM/evaluationPrompt";

export class HypothesisEvaluator {
    private anthropic: Anthropic;
    private model: string = "claude-3-7-sonnet-20250219";

    constructor(apiKey?: string) {
        this.anthropic = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
        });
    }

    /**
     * Decides which paper is most relevant to the given hypothesis
     */
    private async decidePaper(hypothesis: string): Promise<string> {
        const prompt = `
    You are a helpful assistant that decides which paper is most relevant to a given hypothesis.
    Here are the papers:
    ${JSON.stringify(bixbenchPapers, null, 2)}

    The hypothesis is:
    ${hypothesis}

    Please return the short_id of the paper that is most relevant to the hypothesis.
    `;

        const response = await this.anthropic.messages.create({
            model: this.model,
            max_tokens: 1000,
            messages: [{ role: "user", content: prompt }],
        });

        return response.content[0].type === "text"
            ? response.content[0].text
            : "No text response";
    }

    /**
     * Gets the path to the paper most relevant to the given hypothesis
     */
    private async getPaperPath(hypothesis: string): Promise<string> {
        const paperIdResponse = await this.decidePaper(hypothesis);
        const regex = /bix-\d+/g;
        const match = paperIdResponse.match(regex);

        if (!match) {
            throw new Error("No paper found");
        }

        const paperId = match[0];
        const paper = bixbenchPapers.find((p) => p.short_id === paperId);

        if (!paper) {
            throw new Error("Paper not found");
        }

        const { path } = paper;
        elizaLogger.info(`Selected paper path: ${path}`);
        return path;
    }

    /**
     * Evaluates a hypothesis based on relevant scientific papers
     */
    public async evaluate(hypothesis: string): Promise<string> {
        elizaLogger.info(`Evaluating hypothesis: ${hypothesis}`);

        // Get the path to the relevant paper
        const path = await this.getPaperPath(hypothesis);
        elizaLogger.info(`Path: ${path}`);

        // Convert PDF to images
        const options = {
            density: 100,
            saveFilename: "untitled",
            savePath: "./scripts/judge/images",
            format: "png",
            width: 595,
            height: 842,
        };

        const convert = fromPath(path, options);
        const storeHandler = await convert.bulk(-1, { responseType: "base64" });

        // Create image messages for Claude
        const imageMessages = storeHandler
            .filter((page) => page.base64)
            .map((page) => ({
                type: "image" as const,
                source: {
                    type: "base64" as const,
                    media_type: "image/png" as const,
                    data: page.base64!,
                },
            }));

        // Create prompt with the evaluation criteria
        const prompt = `
${evaluationPrompt}

Here is the hypothesis:
<hypothesis>
${hypothesis}
</hypothesis>`;

        // Send evaluation request to Claude
        const response = await this.anthropic.messages.create({
            model: this.model,
            max_tokens: 11000,
            messages: [
                {
                    role: "user",
                    content: [
                        ...imageMessages,
                        {
                            type: "text" as const,
                            text: prompt,
                        },
                    ],
                },
            ],
            thinking: {
                type: "enabled",
                budget_tokens: 10000,
            },
        });

        const score =
            response.content[1]?.type === "text"
                ? response.content[1].text
                : "No text response";

        elizaLogger.info(`Score: ${score}`);
        return score;
    }
}
