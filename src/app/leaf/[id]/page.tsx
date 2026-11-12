import { notFound } from "next/navigation";
import { getLeaf } from "@/server/db";
import { SiteHeader, SiteFooter } from "@/components/brand";
import { LeafResult } from "@/features/leaf/leaf-result";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function LeafPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    leaf = await getLeaf(id);
  if (!leaf) notFound();
  return (
    <>
      <SiteHeader pathname="/" />
      <main className="mx-auto max-w-xl px-5 py-12">
        <LeafResult leaf={leaf} keepsake />
      </main>
      <SiteFooter />
    </>
  );
}
