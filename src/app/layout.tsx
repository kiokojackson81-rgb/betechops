import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToastContainer from './_components/ToastContainer';
import ConfirmProvider from './_components/ConfirmProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BetechOps Operations",
    template: "%s · BetechOps",
  },
  description: "Real-time operations dashboards, support portals, and workflows for the BetechOps team.",
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
  openGraph: {
    type: "website",
    title: "BetechOps Operations",
    description: "Real-time operations dashboards, support portals, and workflows for the BetechOps team.",
    url: "https://betech.co.ke",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-50`}>
        <div className="flex min-h-screen flex-col">
          <ToastContainer />
          <ConfirmProvider />
          <main className="flex-1 w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
