import { IAgentRuntime, logger } from "@elizaos/core";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs/promises";
import { generateKaFromPdf } from "../../kaService/kaService.js";
import DKG from "dkg.js";
import { Anthropic } from "@anthropic-ai/sdk";
import { evaluationPrompt } from "../../evaluators/evaluationPrompt.js";
import { fromPath } from "pdf2pic";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOWNLOAD_FOLDER = path.join(__dirname, "..", "..", "downloads");
const TEST_PDF_PATH = "./science.pdf";

type DKGClient = typeof DKG | null;
let DkgClient: DKGClient = null;

async function ensureDownloadFolder() {
  try {
    await fs.mkdir(DOWNLOAD_FOLDER, { recursive: true });
  } catch (error) {
    logger.error("Error creating download folder:", error);
    throw error;
  }
}

export async function watchFolderChanges(runtime: IAgentRuntime) {
  logger.info("Starting test mode with local PDF file");
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

  await ensureDownloadFolder();

  try {
    logger.info("Processing test PDF file...");
    const ka = await generateKaFromPdf(TEST_PDF_PATH, DkgClient);
    if (!ka) {
      logger.error("Failed to generate KA from PDF");
      return;
    }

    await fs.writeFile(
      path.join(DOWNLOAD_FOLDER, "science.ka.json"),
      JSON.stringify(ka, null, 2)
    );

    let createAssetResult: { UAL: string } | undefined;
    try {
      logger.log("Publishing message to DKG");

      createAssetResult = await DkgClient.asset.create(
        {
          public: ka,
        },
        { epochsNum: 12 }
      );

      logger.log("======================== ASSET CREATED");
      logger.log(JSON.stringify(createAssetResult));
    } catch (error) {
      logger.error(
        "Error occurred while publishing message to DKG:",
        error.message
      );

      if (error.stack) {
        logger.error("Stack trace:", error.stack);
      }
      if (error.response) {
        logger.error(
          "Response data:",
          JSON.stringify(error.response.data, null, 2)
        );
      }
    }

    logger.info("Generating hypothesis from DKG");
    const hypothesis = await generateHypothesis(ka);
    logger.info(`Hypothesis: ${hypothesis}`);
    logger.info("Evaluating hypothesis");
    const score = await evaluateHypothesis(hypothesis, TEST_PDF_PATH);
    logger.info(`Hypothesis evaluated: ${score}`);
  } catch (error) {
    logger.error("Error processing test PDF:", error.stack);
  }

  // Return empty stop function since we're not running an interval
  return {
    stop: () => {},
  };
}

async function generateHypothesis(ka: any) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  const prompt = `
    You are a helpful assistant that generates a hypothesis for a given scientific paper.
    The paper is:
    ${JSON.stringify(ka, null, 2)}
    
    Please generate a hypothesis for the paper.
    Keep it short and concise.
    `;
  const response = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219",
    messages: [{ role: "user", content: prompt }],
    system: prompt,
    max_tokens: 1000,
  });
  return response.content[0].type === "text"
    ? response.content[0].text
    : "No text response";
}

async function evaluateHypothesis(hypothesis: string, pdfPath: string) {
  const options = {
    density: 100,
    format: "png",
    width: 595,
    height: 842,
  };
  const convert = fromPath(pdfPath, options);
  logger.info(`Converting ${pdfPath} to images`);

  const storeHandler = await convert.bulk(-1, { responseType: "base64" });

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

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  const prompt = `
${evaluationPrompt}

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
          ...images,
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

  return score;
}
