import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Strix Enterprise Dashboard",
  description: "Enterprise UI for Strix Autonomous AI Pentesting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark font-sans antialiased", geist.variable)}>
      <body className="min-h-screen bg-background text-foreground overflow-hidden flex">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
          <Header />
          <div className="flex-1 overflow-y-auto overflow-x-hidden animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
