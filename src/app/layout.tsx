import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SessionSync } from "@/components/SessionSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat App",
  description: "Minimal real-time chat",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        <SessionSync />
        {children}
      </body>
    </html>
  );
}
