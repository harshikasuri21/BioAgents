import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { bixbenchPapers } from "./bixbenchPapers";
import { fromPath } from "pdf2pic";
import { elizaLogger } from "@elizaos/core";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function decidePaper(hypothesis: string) {
    const prompt = `
    You are a helpful assistant that decides which paper is most relevant to a given hypothesis.
    Here are the papers:
    ${JSON.stringify(bixbenchPapers, null, 2)}

    The hypothesis is:
    ${hypothesis}

    Please return the short_id of the paper that is most relevant to the hypothesis.
    `;

    const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
    });

    return response.content[0].type === "text"
        ? response.content[0].text
        : "No text response";
}

async function getPaperPath(hypothesis: string) {
    const paperIdResponse = await decidePaper(hypothesis);
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
    console.log(path);
    return path;
}

export async function evaluateHypothesis(hypothesis: string) {
    elizaLogger.info(`Evaluating hypothesis: ${hypothesis}`);
    const path = await getPaperPath(hypothesis);
    elizaLogger.info(`Path: ${path}`);
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
    const prompt = `
You are a scientific hypothesis evaluator with expertise in physics and other scientific domains. Your task is to assess a given hypothesis based on its alignment with a scientific paper and assign it a score out of 10. Your evaluation must consider the following criteria:

1. Clarity and Specificity  
   - Evaluate whether the hypothesis is articulated in clear, precise, and testable terms.  
   - Consider if the language is unambiguous and the proposition is well-defined.

2. Alignment with Evidence  
   - Analyze the extent to which the hypothesis is supported by the data and findings in the scientific paper.  
   - Check for consistency between the hypothesis and the presented empirical evidence.

3. Logical Consistency  
   - Assess whether the hypothesis is logically sound and does not contain internal contradictions.  
   - Verify that it coheres with established theories and scientific principles.

4. Predictive Power  
   - Determine if the hypothesis offers testable predictions that can be empirically verified.  
   - Consider whether the hypothesis can generate further insights or experiments.

5. Falsifiability  
   - Evaluate the degree to which the hypothesis can be proven wrong.  
   - Ensure it is structured in a manner that allows for refutation by evidence.

6. Novelty and Significance  
   - Examine if the hypothesis introduces innovative ideas or perspectives.  
   - Consider the potential impact of the hypothesis on advancing understanding within the field.

For your evaluation, please provide:
- A numerical score (from 1 to 10) based on the overall quality of the hypothesis across these criteria.
- A detailed explanation for the score that outlines the strengths and weaknesses of the hypothesis. Use bullet points and headers to structure your response where appropriate.

Your analysis should be rigorous, technical, and grounded in scientific reasoning. Please ensure that your response is comprehensive and uses sophisticated terminology

Here is the hypothesis:
<hypothesis>
${hypothesis}
</hypothesis>`;

    const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
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
        response.content[1].type === "text"
            ? response.content[1].text
            : "No text response";
    elizaLogger.info(`Score: ${score}`);
    return score;
}
