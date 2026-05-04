import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import AuthProvider from "@/components/auth-provider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
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
        className={`${dmSans.variable} brand-shell antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
