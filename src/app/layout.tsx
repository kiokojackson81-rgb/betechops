import type { Metadata } from "next";
// Avoid fetching Google Fonts during CI/local build; use CSS variable placeholders
// instead of `next/font/google` which performs network requests at build time.
import "./globals.css";
import ToastContainer from './_components/ToastContainer';
import ConfirmProvider from './_components/ConfirmProvider';
import AuthProvider from "@/components/AuthProvider";

const geistSans = { variable: "--font-geist-sans" } as const;
const geistMono = { variable: "--font-geist-mono" } as const;

export const metadata: Metadata = {
  title: {
    default: "BetechOps Operations",
    template: "%s · BetechOps",
  },
  description: "Real-time operations dashboards, support portals, and workflows for the BetechOps team.",
  openGraph: {
    type: "website",
    title: "BetechOps Operations",
    description: "Real-time operations dashboards, support portals, and workflows for the BetechOps team.",
    url: "https://betech.co.ke",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-50`}>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <ToastContainer />
            <ConfirmProvider />
            <main className="flex-1 w-full">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
