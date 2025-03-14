import { google, drive_v3 } from "googleapis";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const getDirName = (importMetaUrl: string) =>
    dirname(fileURLToPath(importMetaUrl));

const __dirname = getDirName(import.meta.url);
const CREDENTIALS_PATH = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "sa_creds.json"
);

/**
 * Initialize and return a Google Drive client
 * @param scopes - The OAuth scopes to request
 * @returns The initialized Google Drive client
 */
export async function initDriveClient(
    scopes: string[] = ["https://www.googleapis.com/auth/drive.readonly"]
): Promise<drive_v3.Drive> {
    try {
        // Load credentials
        const rawFileContents = await fs.readFile(CREDENTIALS_PATH, "utf-8");
        const credentials = JSON.parse(rawFileContents);

        // Set up authentication
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes,
        });

        // Create and return drive client
        return google.drive({ version: "v3", auth });
    } catch (error) {
        console.error("Error initializing Google Drive client:", error);
        throw error;
    }
}

export const FOLDERS = {
    MAIN_FOLDER: "1Ta7TJ6nq5hTbih-3P_Ck9-BeTgBKpCsg",
};
