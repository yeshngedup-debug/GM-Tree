import Link from "next/link";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
      <Sprout size={36} strokeWidth={1} />
      <h1 className="text-4xl">This leaf has drifted away.</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The page may have moved, or this leaf is no longer on the public tree.
      </p>
      <Button asChild>
        <Link href="/">Return to the living tree</Link>
      </Button>
    </main>
  );
}
