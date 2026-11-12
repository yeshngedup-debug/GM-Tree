"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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

gsap.registerPlugin(ScrollTrigger);

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

  gsap.from(".hero-kicker", {
    y: 20,
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
  });
  gsap.from(".hero-title", {
    y: 30,
    opacity: 0,
    duration: 1,
    ease: "power3.out",
    delay: 0.2,
  });
  gsap.from(".hero-subtitle", {
    y: 20,
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
    delay: 0.4,
  });
  gsap.from(".hero-cta", {
    y: 20,
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
    delay: 0.6,
  });

  gsap.from(".theme-chip", {
    y: 20,
    opacity: 0,
    duration: 0.6,
    stagger: 0.1,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".themes-section",
      start: "top 85%",
    },
  });

  gsap.from(".step-card", {
    y: 30,
    opacity: 0,
    duration: 0.6,
    stagger: 0.15,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".steps-section",
      start: "top 85%",
    },
  });

  gsap.from(".leaf-preview", {
    y: 20,
    opacity: 0,
    duration: 0.6,
    stagger: 0.1,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".recent-section",
      start: "top 85%",
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 md:px-6 md:pt-24">
      <AnimatePresence>
        {/* Hero - Cinematic Center */}
        <motion.section
          key="hero"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.8 }}
          className="space-y-8 md:space-y-12"
        >
          <div className="grid gap-8 bg-card p-0 md:grid-cols-[1fr_1fr] md:p-0 rounded-3xl border border-border shadow-[var(--shadow-card)] overflow-hidden">
            <div className="flex flex-col justify-between px-6 py-12 md:px-10 md:py-16">
              <div>
                <p className="hero-kicker inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[10px] text-foreground tracking-wider uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  A shared future. One hope at a time.
                </p>
                <h1 className="hero-title mt-4 max-w-6xl tracking-tight text-4xl md:text-6xl font-light leading-tight">
                  A city grows.<br />
                  So do our hopes.
                </h1>
                <p className="hero-subtitle mt-6 max-w-2xl text-sm leading-6 text-foreground/70 md:text-base md:leading-7">
                  What future do you imagine for Gelephu Mindfulness City? Add
                  one voice to a living tree of possibility.
                </p>
                <div className="hero-cta mt-10 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg">
                    <Link href="/join">
                      Grow your leaf <ArrowUpRight size={17} />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="min-h-[400px] md:min-h-[520px]">
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
        </motion.section>

        {/* Themes */}
        <motion.section
          key="themes"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="space-y-4"
        >
          <p className="text-[10px] font-semibold text-foreground tracking-wider uppercase">Six ways in</p>
          <div
            className="themes-section flex flex-wrap items-center gap-x-6 gap-y-2 md:gap-x-8"
          >
            {themes.map((theme) => (
              <Link
                key={theme.id}
                href={`/join?theme=${theme.id}`}
                className="theme-chip group inline-flex items-center gap-2 text-sm tracking-tight text-foreground/70 hover:text-foreground transition-colors md:text-base"
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
        <motion.section
          key="steps"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="steps-section space-y-0"
        >
          <div className="grid grid-flow-dense grid-cols-1 md:grid-cols-4 gap-4">
            {steps.map(({ number, title, body, Icon }, idx) => (
              <motion.div
                key={number}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * idx }}
                className="step-card flex flex-col gap-3 rounded-xl border border-border bg-card p-6 group hover:border-primary/50 transition-colors"
              >
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <span className="text-[10px] text-foreground">{number}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-foreground/70">{body}</p>
                <span className="mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card group-hover:border-primary/50 transition-colors">
                  <Icon size={16} strokeWidth={1.8} />
                </span>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Recent hopes */}
        <motion.section
          key="recent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="recent-section space-y-4"
        >
          <div className="grid gap-4">
            <p className="text-[10px] font-semibold text-foreground tracking-wider uppercase">Recent hopes</p>
            <ul className="space-y-3">
              {sample.map((leaf) => (
                <LeafPreview key={leaf.id} leaf={leaf} />
              ))}
            </ul>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
