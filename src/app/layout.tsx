import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { HydrationCompatibility } from "@/components/hydration-compat";
import { generateCsrfToken } from "@/server/http";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Gelephu Mindfulness Tree",
  description: "Rooted in values. Growing through people.",
};

async function csrfToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const visitorCookie = cookieStore.get("gmc_visitor")?.value;
  if (!visitorCookie) return null;
  const sessionId = visitorCookie.split(".")[0];
  if (!sessionId) return null;
  return generateCsrfToken(sessionId);
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await csrfToken();
  return (
    <html lang="en" className={geist.variable}>
      <head>
        <HydrationCompatibility />
        {token && (
          <meta name="csrf-token" content={token} />
        )}
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-[var(--radius)]"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
