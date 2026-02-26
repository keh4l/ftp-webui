import type { Metadata } from "next";
import { Lexend, Source_Sans_3, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/layout/nav-bar";


const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
});

const sourceSans3 = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-sc",
  display: "swap",
});

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
    <html
      lang="zh-CN"
      className={`dark ${lexend.variable} ${sourceSans3.variable} ${notoSansSC.variable}`}
    >
      <body className="font-[family-name:var(--font-source-sans)]">
        <NavBar />

        {children}
      </body>
    </html>
  );
}
