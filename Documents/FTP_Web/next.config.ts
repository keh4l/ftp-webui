import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "ssh2", "ssh2-sftp-client", "cpu-features"],
};

export default nextConfig;
