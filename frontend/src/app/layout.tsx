import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Winter Arc | LeetCode Tracker",
  description: "Daily LeetCode challenge tracker with AI code analysis for Winter Arc participants",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex bg-slate-950 text-slate-100 antialiased">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
