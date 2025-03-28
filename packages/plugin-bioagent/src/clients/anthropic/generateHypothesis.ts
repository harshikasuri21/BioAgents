import fs from "fs/promises";
import { splitMarkdownForDiscord } from "./discordSplitter";
import { chooseTwoRelevantKeywords } from "./chooseTwoRelevant";
import { Binding, Abstract } from "./types";
import { sparqlRequest } from "./sparql/makeRequest";
import { FileError, SparqlError } from "./errors";
import { anthropic } from "./client";
import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { getKeywordsQuery, getAbstractsQuery } from "./sparql/queries";
/**
 * Loads a SPARQL query from a file
 * @param path Path to the query file
 * @returns The query as a string
 */
export async function loadQuery(path: string): Promise<string> {
    try {
        return await fs.readFile(path, "utf8");
    } catch (error) {
        throw new FileError(`Failed to load query from ${path}`, error);
    }
}

/**
 * Fetches keywords from the graph database
 */
async function fetchKeywords(): Promise<string[]> {
    const data = await sparqlRequest(getKeywordsQuery);
    return data.results.bindings.map((binding: Binding) => binding.obj.value);
}

/**
 * Fetches abstracts for a given keyword
 */
async function fetchAbstracts(keyword: string): Promise<string[]> {
    const data = await sparqlRequest(
        getAbstractsQuery.replace("{{keyword}}", `"${keyword}"`)
    );
    return data.results.bindings.map(
        (binding: Abstract) => binding.abstract.value
    );
}

/**
 * Ensures the chosen keywords are in array format
 */
function ensureKeywordsArray(chosen: string | string[]): string[] {
    if (Array.isArray(chosen)) {
        return chosen;
    }

    return chosen
        .slice(1, -1) // Remove brackets
        .split(",")
        .map((s) => s.trim());
}

/**
 * Creates a hypothesis generation prompt
 */
function createHypothesisPrompt(
    keywords: string[],
    abstractsOne: string[],
    abstractsTwo: string[]
): string {
    return `
You are a biomedical scientist specializing in generating novel, testable hypotheses that connect seemingly disparate research areas.

## Task
Develop a mechanistic hypothesis that connects ${keywords[0]} and ${
        keywords[1]
    } through specific biological pathways, molecular mechanisms, or cellular processes that could plausibly link these fields.

## Hypothesis Structure
1. Background: Briefly summarize the current state of knowledge for each topic (2-3 sentences per topic)
2. Knowledge Gap: Identify a specific gap in understanding that your hypothesis addresses
3. Central Hypothesis: Clearly state your proposed mechanistic connection in one concise sentence
4. Proposed Mechanism: Detail the step-by-step biological pathway or mechanism (3-5 steps)
5. Testable Predictions: Provide 2-3 specific, falsifiable predictions that would validate your hypothesis
6. Potential Experimental Approaches: Suggest 1-2 experimental methods to test your hypothesis

## Evaluation Criteria
- Novelty: Prioritize non-obvious connections that aren't explicitly stated in the abstracts
- Biological Plausibility: Ensure the mechanism adheres to known biological principles
- Parsimony: Favor simpler explanations that require fewer assumptions
- Falsifiability: Ensure the hypothesis can be tested and potentially disproven

## Research Abstracts for ${keywords[0]}:
${abstractsOne
    .map((abstract, index) => `Abstract ${index + 1}:\n${abstract}`)
    .join("\n\n")}

## Research Abstracts for ${keywords[1]}:
${abstractsTwo
    .map((abstract, index) => `Abstract ${index + 1}:\n${abstract}`)
    .join("\n\n")}

## Additional Guidelines
- Cite specific abstracts when drawing information (e.g., "As shown in Abstract 3...")
- Acknowledge conflicting evidence if present in the abstracts
- Consider alternative mechanisms if multiple plausible pathways exist
- Focus on mechanisms that could reasonably be investigated with current technology
  `.trim();
}

/**
 * Generates a hypothesis connecting two randomly chosen keywords
 */
export async function generateHypothesis(
    agentRuntime: IAgentRuntime
): Promise<{ hypothesis: string; hypothesisMessageId: string }> {
    // @ts-ignore
    const channel = await agentRuntime.clients[1].client.channels.fetch(
        process.env.DISCORD_CHANNEL_ID
    );
    elizaLogger.info("Generating hypothesis...");
    try {
        // Fetch and choose keywords
        const keywords = await fetchKeywords();
        const chosen = await chooseTwoRelevantKeywords(keywords);
        const chosenKeywords = ensureKeywordsArray(chosen);
        console.log("Chosen keywords:", chosenKeywords);

        // Fetch abstracts for both keywords
        const abstractsOne = await fetchAbstracts(chosenKeywords[0]);
        const abstractsTwo = await fetchAbstracts(chosenKeywords[1]);

        // Create prompt and generate hypothesis
        const hypothesisGenerationPrompt = createHypothesisPrompt(
            chosenKeywords,
            abstractsOne,
            abstractsTwo
        );

        console.log("Generating hypothesis...");
        const response = await anthropic.messages.create({
            model: "claude-3-7-sonnet-latest",
            messages: [{ role: "user", content: hypothesisGenerationPrompt }],
            max_tokens: 5001,
            thinking: {
                type: "enabled",
                budget_tokens: 5000,
            },
        });

        const hypothesis =
            response.content[1]?.type === "text"
                ? response.content[1].text
                : "No hypothesis generated";

        console.log("Generated Hypothesis:");
        console.log(hypothesis);
        const chunks = await splitMarkdownForDiscord(hypothesis);
        const messageIds = [];
        for (const chunk of chunks) {
            const message = await channel.send(chunk.content);
            messageIds.push(message.id);
        }
        return { hypothesis, hypothesisMessageId: messageIds[0] }; // return the first message id, which is the hypothesis heading
    } catch (error) {
        if (error instanceof SparqlError) {
            console.error("SPARQL Error:", error.message);
        } else if (error instanceof FileError) {
            console.error("File Error:", error.message);
        } else {
            console.error("Unexpected error:", error);
        }
    }
}
