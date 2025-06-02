import Config from "./config";
import path from "path";
import { PaperSchema, OntologiesSchema, CitationSchema } from "./z";
import {
  ontologiesExtractionPrompt,
  extractionPrompt,
  citationsExtractionPrompt,
} from "./prompts";
import { z } from "zod";
import { OpenAIImage } from "./types";
import { categorizeIntoDAOsPrompt } from "../../kaService/v1/llmPrompt";
import {
  getDoiFromTitle,
  getReferencesFromDoi,
} from "../../../science-api-helper";

const __dirname = path.resolve();

async function extractPaper(images: OpenAIImage[]) {
  console.log(
    `[extractPaper] Starting paper extraction with ${images.length} images`
  );
  const client = Config.instructorOai;

  // TODO: aside of images we could get some data from the internet or OpenAlex, like citations

  const { _meta, ...paper } = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: extractionPrompt,
      },
      {
        role: "user",
        content: [...images],
      },
    ],
    response_model: { schema: PaperSchema, name: "Paper" },
    max_retries: 3,
  });
  console.log(`[extractPaper] Paper extraction completed successfully`);
  return paper;
}

async function extractOntologies(images: OpenAIImage[]) {
  console.log(
    `[extractOntologies] Starting ontologies extraction with ${images.length} images`
  );
  const client = Config.instructorOai;

  const { _meta, ...ontologies } = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: ontologiesExtractionPrompt,
      },
      {
        role: "user",
        content: [...images],
      },
    ],
    // TODO: this is incorrect, 'ontologies' doesn't belong to any ontology
    response_model: { schema: OntologiesSchema, name: "Ontologies" },
    max_retries: 3,
  });
  console.log(
    `[extractOntologies] Ontologies extraction completed successfully`
  );

  // TODO: check if the ontologies match to real world examples, consider using a model with search
  return ontologies;
}

const CitationsSchema = z.object({
  "cito:cites": z.array(CitationSchema),
});

async function extractCitations(images: OpenAIImage[]) {
  console.log(
    `[extractCitations] Starting citations extraction with ${images.length} images (2nd half of the paper)`
  );
  const client = Config.instructorOai;

  const { _meta, ...citations } = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: citationsExtractionPrompt,
      },
      {
        role: "user",
        content: [...images],
      },
    ],
    response_model: { schema: CitationsSchema, name: "Citations" },
    max_retries: 3,
  });
  console.log(`[extractCitations] Citations extraction completed successfully`);
  return citations;
}

export async function categorizeIntoDAOsString(abstract: string) {
  console.log(`[categorizeIntoDAOsString] Abstract: ${abstract}`);

  const client = Config.instructorOai;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: categorizeIntoDAOsPrompt,
      },
      {
        role: "user",
        content: abstract,
      },
    ],
    max_tokens: 250,
  });
  return response.choices[0].message.content;
}

export async function generateKa(images: OpenAIImage[]) {
  console.log(
    `[generateKa] Starting knowledge extraction with ${images.length} images`
  );
  // Get 2nd half of paper for citations extraction
  const secondHalf = images.slice(Math.floor(images.length / 2));

  const res = await Promise.all([
    extractPaper(images),
    extractOntologies(images),
    extractCitations(secondHalf),
  ]);
  console.log(`[generateKa] All extractions completed, combining results`);
  res[0]["schema:about"] = res[1]["schema:about"];

  // Get DOI from science APIs and compare with LLM extracted DOI
  const paperTitle = res[0]["dcterms:title"];
  const llmExtractedDoi = res[0]["@id"];
  console.log(`[generateKa] LLM extracted DOI: ${llmExtractedDoi}`);

  try {
    const scienceApiDoi = await getDoiFromTitle(paperTitle, Config.email);
    if (scienceApiDoi) {
      console.log(`[generateKa] Science API found DOI: ${scienceApiDoi}`);
      if (llmExtractedDoi === scienceApiDoi) {
        console.log(`[generateKa] ✅ LLM correctly extracted DOI`);
      } else {
        console.log(
          `[generateKa] ❌ LLM DOI differs from Science API DOI, using Science API DOI`
        );
        res[0]["@id"] = scienceApiDoi;
      }
    } else {
      console.log(
        `[generateKa] ⚠️ Science API could not find DOI, keeping LLM extracted DOI`
      );
    }
  } catch (error) {
    console.log(`[generateKa] Error getting DOI from science APIs:`, error);
  }

  // Log LLM extracted citations count
  const llmCitations = res[2]["cito:cites"] || [];
  console.log(`[generateKa] LLM extracted ${llmCitations.length} citations`);

  // Get additional citations from science APIs if we have a DOI
  let scienceApiCitations: any[] = [];
  const finalDoi = res[0]["@id"];
  if (finalDoi && finalDoi.includes("doi.org/")) {
    try {
      const doiPart = finalDoi.replace("https://doi.org/", "");
      scienceApiCitations = await getReferencesFromDoi(doiPart, Config.email);
      console.log(
        `[generateKa] Science APIs found ${scienceApiCitations.length} citations`
      );
    } catch (error) {
      console.log(
        `[generateKa] Error getting citations from science APIs:`,
        error
      );
    }
  }

  // Deduplicate and merge citations
  const allCitations = [...llmCitations];
  const existingDoiSet = new Set(llmCitations.map((c: any) => c["@id"]));

  let newCitationsAdded = 0;
  for (const apiCitation of scienceApiCitations) {
    if (!existingDoiSet.has(apiCitation["@id"])) {
      allCitations.push(apiCitation);
      existingDoiSet.add(apiCitation["@id"]);
      newCitationsAdded++;
    }
  }

  console.log(
    `[generateKa] Added ${newCitationsAdded} new citations from science APIs`
  );
  console.log(`[generateKa] Total citations: ${allCitations.length}`);

  res[0]["cito:cites"] = allCitations;
  console.log(`[generateKa] Knowledge extraction successfully completed`);

  const relatedDAOsString = await categorizeIntoDAOsString(
    [
      res[0]["dcterms:abstract"],
      res[0]["dcterms:title"],
      JSON.stringify(res[0]["schema:keywords"]),
    ].join("\n")
  );

  console.log(`[generateKa] Related DAOs: ${relatedDAOsString}`);

  const daos = JSON.parse(relatedDAOsString);

  const daoUalsMap = daos.map((dao) => {
    const daoUal = daoUals[dao];
    return {
      "@id": daoUal,
      "@type": "schema:Organization",
      "schema:name": dao,
    };
  });
  res[0]["schema:relatedTo"] = daoUalsMap;

  return res[0];
}

const daoUals = {
  VitaDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101956",
  AthenaDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101957",
  PsyDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101958",
  ValleyDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101959",
  HairDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101961",
  CryoDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101962",
  "Cerebrum DAO":
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101963",
  Curetopia:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101964",
  "Long Covid Labs":
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101965",
  "Quantum Biology DAO":
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101966",
};
