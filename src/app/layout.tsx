import "./globals.css";
import { IBM_Plex_Sans } from "next/font/google";
import type { Metadata } from "next";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
export const metadata: Metadata = { title: "Job Agent" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className={sans.variable}>{children}</body></html>);
}
