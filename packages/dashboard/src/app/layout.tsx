import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Orchestrator",
  description: "Master control center for all projects",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
