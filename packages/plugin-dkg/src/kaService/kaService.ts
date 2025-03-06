import "dotenv/config";
import { getClient } from "./anthropicClient";
import { downloadPaperAndExtractDOI } from "./downloadPaper";
import { elizaLogger } from "@elizaos/core";
import { makeUnstructuredApiRequest } from "./unstructuredPartitioning";

import { processJsonArray, process_paper, create_graph } from "./processPaper";
import { getSummary } from "./vectorize";
import fs from "fs";

const unstructuredApiKey = process.env.UNSTRUCTURED_API_KEY;

// const jsonArr = JSON.parse(fs.readFileSync('arxiv_paper.json', 'utf8'));

interface PaperArrayElement {
    metadata: {
        page_number: number;
        [key: string]: unknown;
    };
    text: string;
    [key: string]: unknown;
}

interface TaskInstance {
    xcom_push(key: string, value: string): void;
}

interface GeneratedGraph {
    "@context": Record<string, string>;
    "@id"?: string;
    "dcterms:hasPart"?: string;
    "cito:cites"?: unknown;
    [key: string]: unknown;
}

/**
 * Takes an array of JSON elements representing the paper's text
 * and returns a "knowledge assembly" (semantic graph) that includes
 * extracted metadata, citation info, subgraphs, and a summary.
 */
export async function jsonArrToKa(jsonArr: PaperArrayElement[], doi: string) {
    const client = getClient();

    const paperArrayDict = await processJsonArray(jsonArr, client);

    const [
        generatedBasicInfo,
        generatedCitations,
        generatedGoSubgraph,
        generatedDoidSubgraph,
        generatedChebiSubgraph,
        generatedAtcSubgraph,
    ] = await process_paper(client, paperArrayDict);

    const generatedGraph = await create_graph(
        client,
        generatedBasicInfo,
        generatedCitations,
        {
            go: generatedGoSubgraph,
            doid: generatedDoidSubgraph,
            chebi: generatedChebiSubgraph,
            atc: generatedAtcSubgraph,
        }
    );

    generatedGraph["dcterms:hasPart"] = await getSummary(
        client,
        generatedGraph
    );

    generatedGraph["@id"] = `https://doi.org/${doi}`; // the doi that we extracted from the paper

    // Update citations, if they exist
    // if (
    //   generatedGraph['cito:cites'] &&
    //   Array.isArray(generatedGraph['cito:cites']) &&
    //   generatedGraph['cito:cites'].length > 0
    // ) {
    //   generatedGraph['cito:cites'] = getFinalCitations(
    //     generatedGraph['cito:cites'],
    //   );
    // }

    // Ensure @context has schema entry
    const context = generatedGraph["@context"] as Record<string, string>;
    if (!("schema" in context)) {
        context["schema"] = "http://schema.org/";
        elizaLogger.info("Added 'schema' to @context in KA");
    }

    return generatedGraph;
    // console.log(generatedGraph);
}

// jsonArrToKa(jsonArr, {
//   xcom_push: (key: string, value: string) => {
//     console.log(`${key}: ${value}`);
//   },
// });
/**
/**
/**
 * Recursively remove all colons (":") from string values in an object or array,
 * except for certain cases:
 *   1) Skip the entire "@context" object (do not remove colons from any values inside it).
 *   2) Skip any string where the key is "@type".
 *   3) Skip any string that appears to be a URL (starting with "http://", "https://", or "doi:").
 * @param data - The input data which can be an object, array, or primitive.
 * @param parentKey - The key of the parent property (used to check exceptions).
 * @returns A new object, array, or primitive with colons removed from allowed string values.
 */
function removeColonsRecursively<T>(data: T, parentKey?: string): T {
    // 1) If the parent key is "@context", return the data as-is (skip processing entirely)
    if (parentKey === "@context") {
        return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map((item) =>
            removeColonsRecursively(item, parentKey)
        ) as unknown as T;
    }

    // Handle objects
    if (data !== null && typeof data === "object") {
        const newObj: Record<string, unknown> = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                newObj[key] = removeColonsRecursively(
                    (data as Record<string, unknown>)[key],
                    key
                );
            }
        }
        return newObj as T;
    }

    // Handle strings
    if (typeof data === "string") {
        // 2) If this is the value of "@type", skip removing colons.
        if (parentKey === "@type") {
            return data as unknown as T;
        }

        // 3) If it's a URL/DOI (starts with http://, https://, or doi:), skip removing colons.
        if (/^(https?:\/\/|doi:)/i.test(data)) {
            return data as unknown as T;
        }

        // Otherwise, remove all colons
        return data.replace(/:/g, "") as unknown as T;
    }

    // For numbers, booleans, null, etc., just return as is
    return data;
}

export async function generateKa(urls: [string]) {
    for (const url of urls) {
        const { pdfBuffer, doi } = await downloadPaperAndExtractDOI(url);
        if (!pdfBuffer) {
            throw new Error("Failed to download paper");
        }
        if (!doi) {
            throw new Error("Failed to extract DOI");
        }
        const paperArray = await makeUnstructuredApiRequest(
            pdfBuffer,
            "paper.pdf",
            unstructuredApiKey
        );
        const ka = await jsonArrToKa(paperArray, doi);
        const cleanedKa = removeColonsRecursively(ka);
        return cleanedKa;
    }
}
