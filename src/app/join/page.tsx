import { Brand } from "@/components/brand";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { JoinForm } from "@/features/join/join-form";
import { themeSchema } from "@/lib/schemas";

export const metadata = {
  title: "Add your hope",
  description:
    "Share a hope for Gelephu Mindfulness City and grow a leaf on the GM Tree.",
  robots: { index: false, follow: false },
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams,
    theme = themeSchema.safeParse(params.theme);
  return (
    <div className="min-h-[100svh] flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="mx-auto w-full flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <Brand compact />
          <Link
            href="/display"
            className="shrink-0 min-h-10 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground leading-none sm:px-4 sm:text-sm sm:min-h-11"
          >
            Live tree
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full sm:max-w-700 px-4 pt-1 pb-20 sm:px-6 sm:pt-8 sm:pb-24">
        <JoinForm initialTheme={theme.success ? theme.data : undefined} />
      </main>
      <footer className="border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-bottom">
        <div className="mx-auto w-full flex items-center justify-between gap-4 px-4 py-6 sm:px-6 sm:py-8">
          <span className="text-[10px] text-muted-foreground">
            A moment for a shared future.
          </span>
          <Link
            href="/privacy"
            className="text-[10px] text-muted-foreground underline underline-offset-4"
          >
            Participation &amp; privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
