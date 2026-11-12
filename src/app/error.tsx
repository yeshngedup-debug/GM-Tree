"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl">A moment to reconnect.</h1>
      <p className="text-sm text-muted-foreground">
        We could not load this part of the tree. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
