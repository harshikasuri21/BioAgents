import { logger } from "@elizaos/core";

interface ListFilesQueryStrategy {
  buildQuery(): Record<string, any>;
}

class MainFolderStrategy implements ListFilesQueryStrategy {
  constructor(private mainFolderId: string) {}

  buildQuery(): Record<string, any> {
    return {
      q: `'${this.mainFolderId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: "files(id, name, md5Checksum, size)",
      orderBy: "name",
    };
  }
}

class SharedDriveStrategy implements ListFilesQueryStrategy {
  constructor(private sharedDriveId: string) {}

  buildQuery(): Record<string, any> {
    return {
      q: `'${this.sharedDriveId}' in parents and trashed=false`,
      orderBy: "name",
      fields: "files(id, name, md5Checksum, size)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      driveId: this.sharedDriveId,
      corpora: "drive",
    };
  }
}

export class ListFilesQueryContext {
  private strategy: ListFilesQueryStrategy;

  constructor(mainFolderId?: string, sharedDriveId?: string) {
    if (mainFolderId && sharedDriveId) {
      logger.error(
        "You cannot populate both GOOGLE_DRIVE_FOLDER_ID and SHARED_DRIVE_ID."
      );
      process.exit(1);
    } else if (sharedDriveId) {
      this.strategy = new SharedDriveStrategy(sharedDriveId);
    } else if (mainFolderId) {
      this.strategy = new MainFolderStrategy(mainFolderId);
    } else {
      logger.error(
        "Either GOOGLE_DRIVE_FOLDER_ID or SHARED_DRIVE_ID must be defined."
      );
      process.exit(1);
    }
  }

  buildQuery(): Record<string, any> {
    return this.strategy.buildQuery();
  }
}
