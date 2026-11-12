"use client";
import { useEffect, useState } from "react";
import { chambers, chamberDetails, type ChamberId } from "@/lib/catalog";
import { ChamberMap } from "./chamber-map";
export function ChamberExplorer() {
  const [selected, setSelected] = useState<ChamberId>(1);
  useEffect(() => {
    const read = () => {
      const id = Number(location.hash.replace("#chamber-", ""));
      if (id >= 1 && id <= 4) setSelected(id as ChamberId);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return (
    <section
      className="mb-8 grid items-center gap-6 rounded-[var(--radius)] border border-border bg-card p-4 shadow-[var(--shadow-card)] md:grid-cols-[1.5fr_1fr] md:p-7"
      aria-label="Experience centre wayfinding"
    >
      <ChamberMap selected={selected} onSelect={setSelected} />
      <div className="px-2 pb-3">
        <p className="mb-3 text-xs text-muted-foreground">
          Explore the plan · Chamber {selected}
        </p>
        <h2 className="mb-4 text-2xl">
          Chamber {selected}: {chambers[selected]}
        </h2>
        <p className="mb-4 text-sm leading-6 text-muted-foreground">
          {chamberDetails[selected].description}
        </p>
        <p className="rounded-xl border border-border bg-muted/60 p-4 text-xs leading-6">
          {chamberDetails[selected].direction}
        </p>
      </div>
    </section>
  );
}
