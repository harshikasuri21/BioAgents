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
import {
  searchGo,
  searchDoid,
  searchChebi,
  searchAtc,
  searchMondo,
  searchEco,
  searchPw,
  searchMesh,
} from "../../kaService/v1/biologyApi";
import { Anthropic } from "@anthropic-ai/sdk";

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
    response_model: { schema: OntologiesSchema, name: "Ontologies" },
    max_retries: 3,
  });
  console.log(
    `[extractOntologies] Ontologies extraction completed successfully`
  );

  // Validate and update ontology terms with real world IDs
  const validatedOntologies = await validateOntologyTerms(ontologies);
  console.log(`[extractOntologies] Ontology validation completed`);

  return validatedOntologies;
}

/**
 * Validates each ontology term by checking it against real ontology databases
 * and updates the @id field with the correct ontology ID
 */
async function validateOntologyTerms(ontologies: any) {
  if (
    !ontologies["schema:about"] ||
    !Array.isArray(ontologies["schema:about"])
  ) {
    console.log("[validateOntologyTerms] No ontology terms to validate");
    return ontologies;
  }

  const anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY, // Ensure ANTHROPIC_API_KEY is set
  });

  const validatedTerms = [];
  const totalTerms = ontologies["schema:about"].length;
  let validatedCount = 0;
  let updatedCount = 0;

  console.log(
    `[validateOntologyTerms] Validating ${totalTerms} ontology terms`
  );

  for (const term of ontologies["schema:about"]) {
    const termName = term["dcterms:name"]; // Name used for searching
    const originalId = term["@id"]; // Expected to be a CURIE like "GO:0005829"
    let validatedId = originalId; // Default to original if not processed or error
    let wasUpdated = false;

    try {
      if (originalId.startsWith("GO:") || originalId.startsWith("go:")) {
        console.log(`[validateOntologyTerms] Validating GO term: ${termName}`);
        const goResult = await searchGo(termName, anthropicClient); // Returns GO_XXXXXXX or "None"
        if (goResult !== "None") {
          const fullUrl = `http://purl.obolibrary.org/obo/${goResult}`;
          validatedId = goResult; // Use short form as @id
          if (validatedId !== originalId) {
            wasUpdated = true;
            updatedCount++;
          }
          validatedCount++;
          
          // Add schema:url field
          term["schema:url"] = fullUrl;
        }
      } else if (
        originalId.startsWith("DOID:") ||
        originalId.startsWith("doid:")
      ) {
        console.log(
          `[validateOntologyTerms] Validating DOID term: ${termName}`
        );
        const doidResult = await searchDoid(termName, anthropicClient); // Returns DOID_XXXXXXX or "None"
        if (doidResult !== "None") {
          const fullUrl = `http://purl.obolibrary.org/obo/${doidResult}`;
          validatedId = doidResult; // Use short form as @id
          if (validatedId !== originalId) {
            wasUpdated = true;
            updatedCount++;
          }
          validatedCount++;
          
          // Add schema:url field
          term["schema:url"] = fullUrl;
        }
      } else if (
        originalId.startsWith("CHEBI:") ||
        originalId.startsWith("chebi:")
      ) {
        console.log(
          `[validateOntologyTerms] Validating CHEBI term: ${termName}`
        );
        const chebiResult = await searchChebi(termName, anthropicClient); // Returns CHEBI_XXXXXXX or "None"
        if (chebiResult !== "None") {
          const fullUrl = `http://purl.obolibrary.org/obo/${chebiResult}`;
          validatedId = chebiResult; // Use short form as @id
          if (validatedId !== originalId) {
            wasUpdated = true;
            updatedCount++;
          }
          validatedCount++;
          
          // Add schema:url field
          term["schema:url"] = fullUrl;
        }
      } else if (
        originalId.startsWith("ATC:") ||
        originalId.startsWith("atc:")
      ) {
        console.log(`[validateOntologyTerms] Validating ATC term: ${termName}`);
        const atcResult = await searchAtc(termName, anthropicClient); // Returns ATC code e.g., A14AA04 or "None"
        if (atcResult !== "None") {
          const fullUrl = `http://purl.bioontology.org/ontology/ATC/${atcResult}`;
          validatedId = `ATC_${atcResult}`; // Use ATC_ prefix for consistency
          if (validatedId !== originalId) {
            wasUpdated = true;
            updatedCount++;
          }
          validatedCount++;
          
          // Add schema:url field
          term["schema:url"] = fullUrl;
        }
      } else if (
        originalId.startsWith("MONDO:") ||
        originalId.startsWith("mondo:")
      ) {
        console.log(
          `[validateOntologyTerms] Validating MONDO term: ${termName}`
        );
        const mondoResult = await searchMondo(termName, anthropicClient); // Returns MONDO_XXXXXXX or "None"
        if (mondoResult !== "None") {
          const fullUrl = `http://purl.obolibrary.org/obo/${mondoResult}`;
          validatedId = mondoResult; // Use short form as @id
          if (validatedId !== originalId) {
            wasUpdated = true;
            updatedCount++;
          }
          validatedCount++;
          
          // Add schema:url field
          term["schema:url"] = fullUrl;
        }
      } else if (
        originalId.startsWith("ECO:") ||
        originalId.startsWith("eco:")
      ) {
        console.log(`[validateOntologyTerms] Validating ECO term: ${termName}`);
        const ecoResult = await searchEco(termName, anthropicClient); // Returns ECO_XXXXXXX or "None"
        if (ecoResult !== "None") {
          const fullUrl = `http://purl.obolibrary.org/obo/${ecoResult}`;
          validatedId = ecoResult; // Use short form as @id
          if (validatedId !== originalId) {
            wasUpdated = true;
            updatedCount++;
          }
          validatedCount++;
          
          // Add schema:url field
          term["schema:url"] = fullUrl;
        }
      } else if (originalId.startsWith("PW:") || originalId.startsWith("pw:")) {
        // Assuming CURIE for Pathway Ontology is PW:XXXXXXX
        console.log(
          `[validateOntologyTerms] Validating Pathway Ontology (PW) term: ${termName}`
        );
        const pwResult = await searchPw(termName, anthropicClient); // Returns PW_XXXXXXX or "None"
        if (pwResult !== "None") {
          const fullUrl = `http://purl.obolibrary.org/obo/${pwResult}`;
          validatedId = pwResult; // Use short form as @id
          if (validatedId !== originalId) {
            wasUpdated = true;
            updatedCount++;
          }
          validatedCount++;
          
          // Add schema:url field
          term["schema:url"] = fullUrl;
        }
      } else if (
        originalId.startsWith("MESH:") ||
        originalId.startsWith("mesh:")
      ) {
        console.log(
          `[validateOntologyTerms] Validating MeSH term: ${termName}`
        );
        const meshResult = await searchMesh(termName, anthropicClient); // Returns MeSH ID e.g., D008881 or "None"
        if (meshResult !== "None") {
          const fullUrl = `http://purl.bioontology.org/ontology/MESH/${meshResult}`;
          validatedId = `MESH_${meshResult}`; // Use MESH_ prefix for consistency
          if (validatedId !== originalId) {
            wasUpdated = true;
            updatedCount++;
          }
          validatedCount++;
          
          // Add schema:url field
          term["schema:url"] = fullUrl;
        }
      } else {
        console.log(
          `[validateOntologyTerms] Unknown or unhandled ontology type for ID: ${originalId} (term: ${termName})`
        );
        // If it's an unknown type, we still count it as "validated" by keeping the original.
        // Or, you might choose not to increment validatedCount here if these should be errors.
        validatedCount++;
      }

      validatedTerms.push({
        ...term,
        "@id": validatedId, // Update with the new full URI
      });

      if (wasUpdated && validatedId !== originalId) {
        // Check validatedId !== originalId again because wasUpdated might be true even if strings are same due to normalization logic
        console.log(
          `[validateOntologyTerms] ✅ Updated ${termName}: ${originalId} → ${validatedId}`
        );
      } else if (validatedId !== originalId && validatedId !== "None") {
        // If it was not explicitly "updated" by finding a different ID, but a valid ID was formed
        console.log(
          `[validateOntologyTerms] ✅ Confirmed/Formatted ${termName}: ${originalId} → ${validatedId}`
        );
      } else {
        console.log(
          `[validateOntologyTerms] ✅ Retained ${termName}: ${originalId}`
        );
      }
    } catch (error) {
      console.log(
        `[validateOntologyTerms] ❌ Error validating ${termName} (ID: ${originalId}):`,
        error
      );
      // Keep original term on error
      validatedTerms.push(term);
      // Optionally, you might not want to increment validatedCount here or handle errors differently
    }
  }

  console.log(`[validateOntologyTerms] Validation complete:`);
  console.log(`[validateOntologyTerms] - Total terms processed: ${totalTerms}`);
  console.log(
    `[validateOntologyTerms] - Terms for which a validation attempt was made (found or not): ${validatedCount}`
  );
  console.log(
    `[validateOntologyTerms] - Terms updated with new/formatted IDs: ${updatedCount}`
  );
  if (totalTerms > 0) {
    console.log(
      `[validateOntologyTerms] - Validation success rate (based on attempts): ${((validatedCount / totalTerms) * 100).toFixed(1)}%`
    );
  }

  return {
    ...ontologies,
    "schema:about": validatedTerms,
  };
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
