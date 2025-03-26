import "dotenv/config";
import { fromPath } from "pdf2pic";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const options = {
    density: 100,
    saveFilename: "untitled",
    savePath: "./scripts/judge/images",
    format: "png",
    width: 595,
    height: 842,
};
const convert = fromPath("scripts/judge/bix-1.pdf", options);

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
  Answer the following questions based on the document. Answer in the format of (A), (B), (C), or (D).
  Question 1: What is the adjusted p-val threshold for T-cell activation related processes found in the GO enrichment?
  Options: ['(A) raw p-value < 0.05 for T cell terms', '(B) p-adj < 0.05 for T cell activation terms', '(C) p-adj < 0.01 for any immune process', '(D) log2FoldChange > 1.5 for T cell genes']
  Question 2: How many GO terms related to immune processes must show p-adj < 0.05 to establish significant enrichment of immune pathways in the dataset?
  Options: ['(A) At least 10 terms', '(B) At least 50% of all immune-related terms', '(C) All immune-related terms', '(D) At least 1 term']
  Question 3: What variable must be included in the DESeq2 design formula to properly analyze the effect of ASXL1 mutations in a mixed-gender cohort?
  Options: ['(A) batch number', '(B) age', '(C) sex', '(D) sample name']
  Question 4: What clinical feature or criterion should be used as an exclusion factor for patients recruited in the study?
  Options: ['(A) Low sequencing depth', '(B) Presence of confounding medical conditions', '(C) Genetic background', '(D) Age of the patient']
  Question 5: What is the adjusted p-value for neutrophil activation in the gene ontology analysis?
  Options: ['(A) 2.15E-6', '(B) 1.90E-5', '(C) 3.23E-8', '(D) 4.56E-4']
`;

const response = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 1000,
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
});

console.log(
    response.content[0].type === "text"
        ? response.content[0].text
        : "No text response"
);
