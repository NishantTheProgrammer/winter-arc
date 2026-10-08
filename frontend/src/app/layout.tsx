import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Winter Arc | LeetCode Tracker",
  description: "Daily LeetCode challenge tracker with AI code analysis for Winter Arc participants",
};

import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased">
        <ThemeProvider>
          <Sidebar />
          {/*
            Sidebar is fixed/out-of-flow, so we must NOT use flex-1 here.
            - Mobile (< lg):  full width + pt-14 top padding for the fixed mobile header bar
            - Desktop (≥ lg): ml-64 to clear the fixed 256px sidebar
          */}
          <main className="min-h-screen pt-14 lg:pt-0 lg:ml-64">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
