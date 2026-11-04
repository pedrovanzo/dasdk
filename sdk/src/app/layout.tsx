import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  IBM_Plex_Sans,
  Manrope,
  Space_Grotesk,
  Figtree,
  Outfit,
  DM_Sans,
  Sora,
  Lexend,
} from "next/font/google";
import { FontLab } from "@/components/font-lab";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"] });

const fontVariables = [
  geistSans.variable,
  geistMono.variable,
  inter.variable,
  plex.variable,
  manrope.variable,
  spaceGrotesk.variable,
  figtree.variable,
  outfit.variable,
  dmSans.variable,
  sora.variable,
  lexend.variable,
].join(" ");

export const metadata: Metadata = {
  title: "dasdk",
  description: "Agent SDK harness — inspect and evaluate AI agents in the browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <FontLab>{children}</FontLab>
      </body>
    </html>
  );
}
