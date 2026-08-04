import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strix — Security Dashboard",
  description: "Enterprise autonomous AI pentesting platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app">
          <Sidebar />
          <div className="main-area">
            <Header />
            <div className="page-scroll">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
