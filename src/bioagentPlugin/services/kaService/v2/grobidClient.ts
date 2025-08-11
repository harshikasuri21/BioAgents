import axios from "axios";
import FormData from "form-data";
import { Config } from "src/config";

const grobidUrl = Config.GROBID_URL;
const ENDPOINT = `${grobidUrl}/api/processFulltextDocument`;
const now = new Date();

export async function processFulltextDocument(file: Buffer) {
  console.log("Grobid client: Starting processFulltextDocument");
  const form = new FormData();

  form.append("consolidateHeader", "1");
  // form.append("consolidateCitations", "1");
  // form.append("consolidateFunders", "1");
  form.append("includeRawAffiliations", "1");
  form.append("includeRawCitations", "1");
  form.append("segmentSentences", "1");

  form.append("teiCoordinates", "ref");

  form.append("input", file, {
    filename: "bix-6.pdf",
    contentType: "application/pdf",
  });

  // 2. Fire the request
  const { data } = await axios.post(ENDPOINT, form, {
    // axios respects the boundary ONLY if you forward form-data’s own headers
    headers: {
      Authorization: `Bearer ${Config.HF_TOKEN}`,
      ...form.getHeaders(),
    },

    // GROBID can spit out TEI up to several MB; disable the limits
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 120_000, // ms – tune to your latency
  });

  const end = new Date();
  console.log(
    `Grobid client: Time taken: ${(end.getTime() - now.getTime()) / 1000}s`
  );

  return data as string; // TEI XML
}
