import Config from "./config";
import { fromPath } from "pdf2pic";
import path from "path";
import fs from "fs/promises";
import { OpenAIImage } from "./types";
import { PaperSchema } from "./z";

console.log("Hello from BioGraph!");
console.log("Reading papers from", Config.papersDirectory);

const __dirname = path.resolve();

const systemPrompt = await fs.readFile(
  path.join(__dirname, "systemPrompt.txt"),
  "utf-8"
);

const papers = ["bix-2.pdf", "bix-1.pdf", "bix-6.pdf"];

for (const paper of papers) {
  console.log("Processing", paper);
  const converter = fromPath(
    path.join(Config.papersDirectory, paper),
    Config.pdf2PicOptions
  );
  const storeHandler = await converter.bulk(-1, { responseType: "base64" });

  const images: OpenAIImage[] = storeHandler
    .filter((page) => page.base64)
    .map((page) => ({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${page.base64}`,
      },
    }));

  const client = Config.instructorOai;

  console.log("Extracting schema...");
  const { _meta, ...response } = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: [...images],
      },
    ],
    response_model: { schema: PaperSchema, name: "Paper" },
    max_retries: 3,
  });

  console.log(`Schema extracted, writing to file... ${paper}`);

  await fs.writeFile(
    path.join(Config.papersDirectory, `${paper}.json`),
    JSON.stringify(response, null, 2)
  );
}
