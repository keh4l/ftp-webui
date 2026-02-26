import { decrypt } from "@/lib/crypto";
import { connectionNotFound, validationError } from "@/lib/errors";
import { BrowseService } from "@/lib/file/browse-service";
import { EditService } from "@/lib/file/edit-service";
import { TransferService } from "@/lib/file/transfer-service";
import { logger } from "@/lib/logger";
import { FtpAdapter } from "@/lib/protocol/ftp-adapter";
import { SftpAdapter } from "@/lib/protocol/sftp-adapter";
import type { ConnectionConfig, ProtocolAdapter } from "@/lib/protocol/types";
import { SqliteConnectionRepository } from "@/lib/connection";
import { getConnectionService, handleApiError } from "@/lib/api/helpers";

let repositorySingleton: SqliteConnectionRepository | null = null;
let browseServiceSingleton: BrowseService | null = null;
let transferServiceSingleton: TransferService | null = null;
let editServiceSingleton: EditService | null = null;

function getConnectionRepository(): SqliteConnectionRepository {
  getConnectionService();

  if (repositorySingleton) {
    return repositorySingleton;
  }

  repositorySingleton = new SqliteConnectionRepository();
  repositorySingleton.init();
  return repositorySingleton;
}

export async function resolveAdapter(connectionId: string): Promise<ProtocolAdapter> {
  const repository = getConnectionRepository();
  const connection = repository.findById(connectionId);
  if (!connection) {
    throw connectionNotFound(connectionId);
  }

  const config: ConnectionConfig = {
    protocol: connection.protocol,
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: decrypt(connection.encryptedSecret),
  };

  const adapter = createAdapter(config.protocol);
  await adapter.connect(config);

  logger.info(
    {
      connectionId,
      protocol: config.protocol,
      host: config.host,
      port: config.port,
    },
    "Resolved and connected protocol adapter",
  );

  return adapter;
}

function createAdapter(protocol: ConnectionConfig["protocol"]): ProtocolAdapter {
  if (protocol === "ftp" || protocol === "ftps") {
    return new FtpAdapter();
  }

  if (protocol === "sftp") {
    return new SftpAdapter();
  }

  throw validationError({
    protocol,
    message: `Unsupported protocol: ${protocol}`,
  });
}

export function getBrowseService(): BrowseService {
  if (!browseServiceSingleton) {
    browseServiceSingleton = new BrowseService(resolveAdapter);
  }

  return browseServiceSingleton;
}

export function getTransferService(): TransferService {
  if (!transferServiceSingleton) {
    transferServiceSingleton = new TransferService(resolveAdapter);
  }

  return transferServiceSingleton;
}

export function getEditService(): EditService {
  if (!editServiceSingleton) {
    editServiceSingleton = new EditService(resolveAdapter);
  }

  return editServiceSingleton;
}

export { handleApiError };
