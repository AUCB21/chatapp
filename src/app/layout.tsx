import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SessionSync } from "@/components/SessionSync";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat App",
  description: "Minimal real-time chat",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <SessionSync />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
