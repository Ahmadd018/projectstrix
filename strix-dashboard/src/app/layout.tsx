import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import "./globals.css";

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
    <html lang="en">
      <body>
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <Header />
            <div className="page-container animate-fade-in">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
