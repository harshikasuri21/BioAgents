import Config from "./config";
import path from "path";
import fs from "fs/promises";
import { PaperSchema } from "./z";

const __dirname = path.resolve();

async function processTextFile(filePath: string) {
  const systemPrompt = await fs.readFile(
    path.join(__dirname, "systemPrompt.txt"),
    "utf-8"
  );

  const text = await fs.readFile(filePath, "utf-8");
  const client = Config.instructorOai;

  const { _meta, ...response } = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: text,
      },
    ],
    response_model: { schema: PaperSchema, name: "Paper" },
    max_retries: 3,
  });

  const outputDir = path.join(__dirname, "output");
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(
    outputDir,
    `${path.basename(filePath, ".txt")}.json`
  );

  await fs.writeFile(outputPath, JSON.stringify(response, null, 2));
  console.log(`Processed ${filePath} -> ${outputPath}`);
}

async function main() {
  const txtDir = path.join(__dirname, "77 txt");
  const files = await fs.readdir(txtDir);

  for (const file of files) {
    if (file.endsWith(".txt")) {
      try {
        await processTextFile(path.join(txtDir, file));
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
    }
  }
}

main().catch(console.error);
