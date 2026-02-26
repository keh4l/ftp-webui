export const ConnectionProtocol = {
  FTP: "ftp",
  FTPS: "ftps",
  SFTP: "sftp",
} as const;

export type ConnectionProtocol =
  (typeof ConnectionProtocol)[keyof typeof ConnectionProtocol];

export type Connection = {
  id: string;
  protocol: ConnectionProtocol;
  host: string;
  port: number;
  username: string;
  encryptedSecret: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateConnectionInput = {
  protocol: ConnectionProtocol;
  host: string;
  port: number;
  username: string;
  encryptedSecret: string;
  label?: string | null;
};
