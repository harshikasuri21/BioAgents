import { IAgentRuntime, logger } from "@elizaos/core";
import { initDriveClient, FOLDERS } from "./client.js";
import { drive_v3 } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs/promises";
import { generateKaFromPdf } from "../../kaService/kaService.js";
import DKG from "dkg.js";
import { Anthropic } from "@anthropic-ai/sdk";
import { evaluationPrompt } from "../../evaluators/evaluationPrompt.js";
import { fromPath } from "pdf2pic";
type Schema$File = drive_v3.Schema$File;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOWNLOAD_FOLDER = path.join(__dirname, "..", "..", "downloads");

type DKGClient = typeof DKG | null;
let DkgClient: DKGClient = null;

interface FileInfo {
  id: string;
  name: string;
  md5Checksum: string;
}

async function ensureDownloadFolder() {
  try {
    await fs.mkdir(DOWNLOAD_FOLDER, { recursive: true });
  } catch (error) {
    logger.error("Error creating download folder:", error);
    throw error;
  }
}

async function downloadFile(
  drive: drive_v3.Drive,
  file: FileInfo
): Promise<Buffer> {
  const res = await drive.files.get(
    {
      fileId: file.id,
      alt: "media",
    },
    {
      responseType: "arraybuffer",
      params: {
        supportsAllDrives: true,
        acknowledgeAbuse: true,
      },
      headers: {
        Range: "bytes=0-",
      },
    }
  );

  return Buffer.from(res.data as ArrayBuffer);
}

async function getFilesInfo(): Promise<FileInfo[]> {
  const drive = await initDriveClient();
  const response = await drive.files.list({
    q: `'${FOLDERS.MAIN_FOLDER}' in parents and mimeType='application/pdf' and trashed=false`,
    fields: "files(id, name, md5Checksum)",
    orderBy: "name",
  });

  return (response.data.files || [])
    .filter(
      (
        f
      ): f is Schema$File & {
        id: string;
        name: string;
        md5Checksum: string;
      } => f.id != null && f.name != null && f.md5Checksum != null
    )
    .map((f) => ({ id: f.id, name: f.name, md5Checksum: f.md5Checksum }));
}

export async function watchFolderChanges(runtime: IAgentRuntime) {
  logger.info("Watching folder changes");
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
  let knownHashes = new Set<string>();
  let processedFiles = new Set<string>(); // Track files we've already processed
  await ensureDownloadFolder();
  const drive = await initDriveClient();
  let intervalId: NodeJS.Timeout | null = null;
  let isRunning = true;

  const checkForChanges = async () => {
    if (!isRunning) return;

    try {
      const files = await getFilesInfo();
      const currentHashes = new Set(files.map((f) => f.md5Checksum));

      // Check for new files by hash that we haven't processed yet
      const newFiles = files.filter(
        (f) => !knownHashes.has(f.md5Checksum) && !processedFiles.has(f.id)
      );

      if (newFiles.length > 0) {
        logger.info(
          "New files detected:",
          newFiles.map((f) => `${f.name} (${f.md5Checksum})`)
        );

        // Download new files
        for (const file of newFiles) {
          logger.info(`Downloading ${file.name}...`);
          const pdfBuffer = await downloadFile(drive, file);
          logger.info(`Successfully downloaded ${file.name}`);

          // Mark as processed immediately after download
          processedFiles.add(file.id);

          const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const pdfPath = path.join(DOWNLOAD_FOLDER, safeFileName);
          await fs.writeFile(pdfPath, pdfBuffer);

          const ka = await generateKaFromPdf(pdfPath, DkgClient);
          if (!ka) {
            continue;
          }
          await fs.writeFile(
            path.join(DOWNLOAD_FOLDER, `${file.name}.ka.json`),
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
          const score = await evaluateHypothesis(hypothesis, pdfPath);
          logger.info(`Hypothesis evaluated: ${score}`);
        }
      }

      knownHashes = currentHashes;
    } catch (error) {
      logger.error("Error checking files:", error.stack);
    }
  };

  // Start the interval
  checkForChanges();
  intervalId = setInterval(checkForChanges, 10000); // Check every 10 seconds

  // Return a function to stop watching
  return {
    stop: () => {
      isRunning = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
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
