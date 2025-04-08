import { type IAgentRuntime, logger } from "@elizaos/core";
import { driveSyncTable, gdriveChannelsTable } from "src/db";
import { initDriveClient } from "./services/gdrive";
import { drive_v3 } from "googleapis";
import { ListFilesQueryContext } from "./services/gdrive/buildQuery";
import "dotenv/config";

interface WatchResponse {
  resourceId: string;
  expiration: string;
  kind: string;
  id: string;
  resourceUri: string;
}

/**
 * Sets up a watch channel for file changes in a specific folder
 * @param folderId - The ID of the folder to watch
 * @param callbackUrl - The URL where change notifications will be sent
 * @param options - Additional options for shared drives
 * @returns Promise containing the watch response
 */
async function watchFolderChanges(
  folderId: string,
  callbackUrl: string,
  drive: drive_v3.Drive,
  options: {
    includeItemsFromAllDrives?: boolean;
    supportsAllDrives?: boolean;
    corpora?: "user" | "domain" | "drive" | "allDrives";
    driveId?: string;
  } = {}
): Promise<WatchResponse> {
  const response = await drive.files.watch({
    fileId: folderId,
    ...options,
    requestBody: {
      id: `channel-${Date.now()}`,
      type: "web_hook",
      address: callbackUrl,
      payload: true,
      expiration: (Date.now() + 604800000).toString(), // 7 days
    },
  });

  logger.info("Watch channel created: ");
  logger.info(JSON.stringify(response.data, null, 2));

  return response.data as WatchResponse;
}

async function stopWatchingChanges(
  channelId: string,
  resourceId: string,
  drive: drive_v3.Drive
): Promise<void> {
  await drive.channels.stop({
    requestBody: {
      id: channelId,
      resourceId: resourceId,
    },
  });
}

export async function initDriveSync(runtime: IAgentRuntime) {
  const driveClient = await initDriveClient([
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
  ]);
  const listFilesQueryContext = new ListFilesQueryContext(
    process.env.GOOGLE_DRIVE_FOLDER_ID,
    process.env.SHARED_DRIVE_ID
  );
  const startPageTokenParams = listFilesQueryContext.getStartPageTokenParams();
  const startPageTokenResponse =
    await driveClient.changes.getStartPageToken(startPageTokenParams);
  const startPageToken = startPageTokenResponse.data.startPageToken;
  const driveType = listFilesQueryContext.getDriveType();
  const driveId = listFilesQueryContext.getDriveId();

  const driveSync = await runtime.db.select().from(driveSyncTable);
  if (driveSync.length === 0) {
    logger.info("Initializing drive sync");
    logger.info("No drive sync found, creating new one");
    await runtime.db.insert(driveSyncTable).values({
      id: driveId,
      startPageToken,
      driveType,
    });
  } else {
    logger.info("Drive sync already initialized");
  }
  const gdriveChannel = await runtime.db.select().from(gdriveChannelsTable);
  if (gdriveChannel.length === 0) {
    logger.info("Watching folder changes");
    const watchFolderResponse = await watchFolderChanges(
      driveId,
      `${process.env.PROD_URL}/api/gdrive/webhook`,
      driveClient,
      listFilesQueryContext.getWatchFolderParams()
    );
    await runtime.db.insert(gdriveChannelsTable).values({
      kind: watchFolderResponse.kind,
      id: watchFolderResponse.id,
      resourceId: driveId,
      resourceUri: watchFolderResponse.resourceUri,
      expiration: new Date(parseInt(watchFolderResponse.expiration)),
    });
  } else if (gdriveChannel.length === 1) {
    logger.info("Found one channel, checking expiration...");
    if (gdriveChannel[0].expiration < new Date()) {
      await stopWatchingChanges(
        gdriveChannel[0].id,
        gdriveChannel[0].resourceId,
        driveClient
      );
      await runtime.db.delete(gdriveChannelsTable);
      const watchFolderResponse = await watchFolderChanges(
        driveId,
        `${process.env.PROD_URL}/api/gdrive/webhook`,
        driveClient,
        listFilesQueryContext.getWatchFolderParams()
      );
      await runtime.db.insert(gdriveChannelsTable).values({
        kind: watchFolderResponse.kind,
        id: watchFolderResponse.id,
        resourceId: driveId,
        resourceUri: watchFolderResponse.resourceUri,
        expiration: new Date(parseInt(watchFolderResponse.expiration)),
      });
    } else {
      logger.info("Watch channel is still valid, no need to update");
    }
  } else if (gdriveChannel.length > 0) {
    logger.info("Multiple watch channels found, deleting all");
    for (const channel of gdriveChannel) {
      if (channel.expiration < new Date()) {
        await stopWatchingChanges(channel.id, channel.resourceId, driveClient);
      }
    }
    await runtime.db.delete(gdriveChannelsTable);
    const watchFolderResponse = await watchFolderChanges(
      driveId,
      `${process.env.PROD_URL}/api/gdrive/webhook`,
      driveClient,
      listFilesQueryContext.getWatchFolderParams()
    );
    await runtime.db.insert(gdriveChannelsTable).values({
      kind: watchFolderResponse.kind,
      id: watchFolderResponse.id,
      resourceId: driveId,
      resourceUri: watchFolderResponse.resourceUri,
      expiration: new Date(parseInt(watchFolderResponse.expiration)),
    });
  } else {
    logger.info("Already watching folder changes");
  }
}
