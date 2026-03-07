import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import { NavBar } from "@/components/layout/nav-bar";

const fontVariables: CSSProperties & {
  "--font-lexend": string;
  "--font-source-sans": string;
  "--font-noto-sans-sc": string;
} = {
  "--font-lexend": '"Inter", "Segoe UI", "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
  "--font-source-sans": '"Inter", "Segoe UI", "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
  "--font-noto-sans-sc": '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif',
};

export const metadata: Metadata = {
  title: "FTP WebUI",
  description: "FTP/SFTP 运维管理面板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" style={fontVariables}>
      <body className="font-[family-name:var(--font-source-sans)]">
        <NavBar />

        {children}
      </body>
    </html>
  );
}
