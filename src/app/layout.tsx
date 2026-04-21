import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans, Syne } from "next/font/google";
import AuthProvider from "@/components/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bodyFont = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const displayFont = Syne({
  variable: "--font-brand-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FBR Digital Invoicing Software Pakistan | FBR Live POS",
  description: "Pakistan's FBR digital invoicing and tax advisory platform with DI API submission, pricing plans, audit-ready workflows, and multi-tenant operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bodyFont.variable} ${displayFont.variable} brand-shell antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
