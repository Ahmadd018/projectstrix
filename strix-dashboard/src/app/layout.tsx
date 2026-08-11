import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strix — Security Dashboard",
  description: "Enterprise autonomous AI pentesting platform",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

import { DialogProvider } from "@/components/DialogProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DialogProvider>
          {children}
        </DialogProvider>
      </body>
    </html>
  );
}
