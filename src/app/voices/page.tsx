import Link from "next/link";
import { Brand } from "@/components/brand";
import { VisitorVoices } from "@/features/join/visitor-voices";
export const metadata = {
  title: "Your previous voices",
  robots: { index: false, follow: false },
};
export default function VoicesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="mx-auto max-w-700 w-full flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Brand compact />
          <Link
            href="/join"
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Add a hope
          </Link>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-700 w-full px-4 py-8 sm:px-6 sm:py-12">
        <VisitorVoices />
      </main>
      <footer className="border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-700 w-full flex items-center justify-between gap-4 px-4 py-6 sm:px-6 sm:py-8">
          <span className="text-[10px] text-muted-foreground">
            Rooted in values. Growing through people.
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
