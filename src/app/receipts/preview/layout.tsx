import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Betech receipt preview",
};

export default function ReceiptPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-black">
        {children}
      </body>
    </html>
  );
}
