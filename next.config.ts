import type { NextConfig } from "next";

const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["better-sqlite3", "ssh2", "ssh2-sftp-client", "cpu-features"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
