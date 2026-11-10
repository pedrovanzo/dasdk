import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Bot } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "dasdk",
  description: "Agent SDK harness — inspect and evaluate AI agents in the browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4 text-sm">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Bot className="h-5 w-5" aria-hidden />
              dasdk
            </Link>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Demo Agent Software Development Kit
            </span>
            <Link href="/agents" className="ml-auto text-muted-foreground hover:text-foreground">
              Agents
            </Link>
            <Link href="/docs" className="text-muted-foreground hover:text-foreground">
              Docs
            </Link>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
