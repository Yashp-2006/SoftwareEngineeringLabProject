import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "TaiKaiX — Operations Hub",
  description: "Next-gen karate tournament management system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script src="https://unpkg.com/lucide@latest" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" strategy="beforeInteractive" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <Sidebar />
          {children}
        </AuthProvider>
        <Script id="init-lucide" strategy="afterInteractive">
          {`if (typeof lucide !== 'undefined') { lucide.createIcons(); }`}
        </Script>
      </body>
    </html>
  );
}
