import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Sidebar from "@/modules/core/layout/Sidebar";
import { AuthProvider } from "@/modules/auth/components/AuthProvider";
import { Toaster } from "react-hot-toast";

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <Toaster 
            position="bottom-right" 
            toastOptions={{
              className: 'text-small',
              style: {
                background: 'var(--shiro)',
                color: 'var(--neutral-900)',
                border: '1px solid var(--neutral-300)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                borderRadius: '12px'
              },
            }} 
          />
          <Sidebar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
