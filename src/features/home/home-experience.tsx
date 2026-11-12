"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
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

const faqs = [
  {
    question: "Do I need an account to add a hope?",
    answer:
      "No. There is no sign-up and we do not ask for your name or contact details.",
  },
  {
    question: "What happens after I submit?",
    answer:
      "Your words are reviewed and, once approved, grow as a leaf on the shared tree.",
  },
  {
    question: "Can I keep my hope private?",
    answer:
      "Only the approved leaf becomes public. Your original words stay private.",
  },
];

function LeafPreview({ leaf }: { leaf: Leaf }) {
  const theme = themeFor(leaf.category);
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-3 rounded-xl border border-border bg-card p-3"
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
        <ThemeIcon theme={theme.id} size={14} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-foreground">{theme.short}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-5">{leaf.leaf_message}</span>
      </span>
    </motion.li>
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
    <div className="mx-auto max-w-7xl px-4 pb-6 pt-8 md:px-6 md:pt-12">
      <AnimatePresence>
        <motion.section
          key="hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6 }}
          className="space-y-12 md:space-y-16"
        >
          {/* Hero */}
          <div className="grid gap-4 bg-card p-6 md:grid-cols-[1.05fr_1fr] md:p-8 rounded-3xl border border-border shadow-[var(--shadow-card)]">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[10px] text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  A shared future. One hope at a time.
                </p>
                <h1 className="mt-4 tracking-tight text-4xl md:text-6xl font-light">
                  A city grows.<br />
                  So do our <span className="text-primary">hopes.</span>
                </h1>
                <p className="mt-6 max-w-sm text-sm leading-6 text-foreground md:text-base md:leading-7">
                  What future do you imagine? Add one voice to a living tree.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg">
                    <Link href="/join">
                      Grow your leaf <ArrowUpRight size={17} />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="min-h-[300px] md:min-h-[380px]">
                <TreeCanvas
                leaves={leaves}
                illustrative={!leaves.length}
                settings={tree?.settings}
                contributionCount={tree?.total || 0}
                className="home-tree-canvas"
                showControls={false}
                environment="garden"
              />
            </div>
          </div>
        </div>

          {/* Themes */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold text-foreground tracking-wider uppercase">Six ways in</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:gap-x-8">
              {themes.map((theme) => (
                <Link
                  key={theme.id}
                  href={`/join?theme=${theme.id}`}
                  className="group inline-flex items-center gap-2 text-sm tracking-tight text-foreground/70 hover:text-foreground transition-colors md:text-base"
                >
                  <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: theme.color }} />
                    {theme.short}
                  </motion.span>
                </Link>
              ))}
            </div>
          </section>
        </motion.section>

        {/* How it works */}
        <motion.section
          key="steps"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-12 space-y-8"
        >
          <div className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-5">
              <p className="text-[10px] font-semibold text-foreground tracking-wider uppercase">How a hope grows</p>
              <h2 className="mt-2 tracking-tight text-3xl md:text-4xl font-light">From a thought to a canopy.</h2>
              <div className="mt-6 space-y-4">
                {steps.map(({ number, title, body, Icon }, idx) => (
                  <motion.div
                    key={number}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 * idx }}
                    className="flex gap-3 rounded-xl p-3 border border-border bg-card hover:bg-muted transition-colors"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-semibold">{title}</h3>
                        <span className="text-[10px] text-foreground">/{number}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-foreground">{body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="md:col-span-7 flex flex-col justify-center gap-2 bg-muted/40 rounded-2xl p-4 md:p-6 border border-border">
              <p className="text-[10px] font-semibold text-foreground tracking-wider uppercase">Recent hopes</p>
              <ul className="mt-2 space-y-2">
                {sample.map((leaf) => (
                  <LeafPreview key={leaf.id} leaf={leaf} />
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

      </AnimatePresence>
    </div>
  );
}
