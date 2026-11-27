import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { APP_NAME, dueTaskCount } from "@/lib/queries";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Personal CRM and prospecting workspace",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const due = await dueTaskCount();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="flex min-h-screen font-sans">
        <Sidebar dueCount={due} appName={APP_NAME} />
        <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
      </body>
    </html>
  );
}
