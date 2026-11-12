"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  Sprout,
  Sparkles,
  Compass,
} from "lucide-react";
import { useTree } from "@/hooks/use-tree";
import dynamic from "next/dynamic";
import type { TreeCanvasProps } from "@/features/display/tree-canvas";
const TreeCanvas = dynamic<TreeCanvasProps>(
  () => import("@/features/display/tree-canvas").then((mod) => mod.TreeCanvas),
  { ssr: false },
);
import { Button } from "@/components/ui/button";
import { ThemeIcon } from "@/components/theme-icon";
import { themes, themeFor, type Leaf } from "@/lib/catalog";

const steps = [
  {
    number: "01",
    title: "Pause and imagine",
    body: "Choose what matters to you and share one hope for the city's future.",
    Icon: Sparkles,
  },
  {
    number: "02",
    title: "Watch it take root",
    body: "Once staff approve it, your hope becomes a glowing leaf on the tree.",
    Icon: Sprout,
  },
  {
    number: "03",
    title: "Follow your curiosity",
    body: "Every hope suggests a chamber to explore next.",
    Icon: Compass,
  },
];

function LeafPreview({ leaf }: { leaf: Leaf }) {
  const theme = themeFor(leaf.category);
  return (
    <li
      className="flex gap-3 rounded-xl border border-border bg-card p-3 group hover:border-primary/50 transition-colors"
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
        <ThemeIcon theme={theme.id} size={14} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-foreground">{theme.short}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-foreground/70">
          {leaf.leaf_message}
        </span>
      </span>
    </li>
  );
}

export function HomeExperience() {
  const { tree } = useTree();
  const total = tree?.total ?? 0;
  const leaves = tree?.leaves ?? [];
  const sample: Leaf[] =
    leaves.length > 0
      ? leaves.slice(0, 3)
      : themes.slice(0, 3).map((theme, index) => ({
          id: `sample-${theme.id}`,
          category: theme.id,
          leaf_message: theme.message,
          chamber_id: theme.chamber as Leaf["chamber_id"],
          chamber_reason: "",
          created_at: new Date(0).toISOString(),
          mode: "offline",
          is_demo: index === 0,
        }));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 md:px-6 md:pt-16">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="home-hero-grid relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-[var(--shadow-frame)]"
      >
        <div className="relative z-10 flex flex-col justify-center px-6 py-12 sm:px-10 md:px-14 md:py-16 lg:py-20">
          <motion.p
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
          >
            <span className="home-pulse h-1.5 w-1.5 rounded-full bg-primary" />
            A shared future, one hope at a time
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-5xl font-medium leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-7xl"
          >
            A city grows.<br /><span className="hero-highlight">So do our hopes.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.55 }}
            className="mt-7 max-w-md text-base leading-7 text-muted-foreground"
          >
            What future do you imagine for Gelephu Mindfulness City? Add one voice to a living tree of possibility.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44, duration: 0.5 }} className="mt-9 flex flex-wrap items-center gap-4">
            <Button asChild size="lg"><Link href="/join">Grow your leaf <ArrowUpRight size={17} /></Link></Button>
            <Link href="/display" className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary">See the live tree <ArrowUpRight className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={15} /></Link>
          </motion.div>
          <div className="mt-12 flex items-center gap-4 border-t border-border/80 pt-5 text-xs text-muted-foreground">
            <span className="text-2xl font-medium tracking-[-0.06em] text-foreground">{total.toLocaleString()}</span>
            <span className="max-w-24 leading-4">hopes taking root</span>
          </div>
        </div>
        <div className="home-tree-panel relative min-h-[360px] overflow-hidden border-t border-border bg-muted/60 md:min-h-full md:border-t-0 md:border-l">
          <div className="home-tree-glow" />
          <TreeCanvas leaves={leaves} illustrative={!leaves.length} settings={tree?.settings} contributionCount={total} className="home-tree-canvas relative z-10" showControls={false} environment="garden" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-muted/70 to-transparent" />
          <p className="absolute bottom-5 left-6 z-30 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">A living canopy</p>
        </div>
      </motion.section>

        {/* Themes */}
        <motion.section initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.5 }} className="mt-14 border-y border-border py-6">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Six ways in</p>
          <div
            className="themes-section flex flex-wrap items-center gap-x-6 gap-y-2 md:gap-x-8"
          >
            {themes.map((theme) => (
              <Link
                key={theme.id}
                href={`/join?theme=${theme.id}`}
                className="theme-chip group inline-flex items-center gap-2 text-sm tracking-tight text-muted-foreground transition-colors hover:text-foreground md:text-base"
              >
                <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: theme.color }} />
                  {theme.short}
                </motion.span>
              </Link>
            ))}
          </div>
        </motion.section>

        {/* How it works - Bento grid */}
        <section className="steps-section mt-16">
          <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">How it works</p><h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">A quiet ritual of belonging.</h2></div><span className="hidden text-sm text-muted-foreground md:block">Three simple moments</span></div>
          <div className="grid grid-flow-dense grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map(({ number, title, body, Icon }, idx) => (
              <motion.div
                key={number}
                initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, delay: 0.1 * idx }}
                className="step-card group flex min-h-60 flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <span className="text-[10px] text-muted-foreground">{number}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-foreground/70">{body}</p>
                <span className="mt-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted transition-colors group-hover:border-primary/50 group-hover:bg-primary/10">
                  <Icon size={16} strokeWidth={1.8} />
                </span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Recent hopes */}
        <motion.section initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.5 }} className="recent-section mt-16 rounded-2xl border border-border bg-muted/45 p-6 md:p-8">
          <div className="grid gap-5 md:grid-cols-[0.65fr_1.35fr] md:gap-12"><div><p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Recent hopes</p><h2 className="mt-3 max-w-xs text-2xl font-medium leading-tight tracking-[-0.04em]">Small thoughts. Shared direction.</h2><Link href="/voices" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary">Hear more voices <ArrowUpRight size={15} /></Link></div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {sample.map((leaf) => (
                <LeafPreview key={leaf.id} leaf={leaf} />
              ))}
            </ul>
          </div>
        </motion.section>
    </div>
  );
}
