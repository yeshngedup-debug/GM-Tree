import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/brand";
import { chambers, chamberDetails, themes } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { ChamberExplorer } from "@/features/chambers/chamber-explorer";
export default function ChambersPage() {
  return (
    <>
      <SiteHeader pathname="/chambers" />
      <main className="mx-auto max-w-6xl px-6 py-16 md:px-10">
        <p className="eyebrow mb-5 text-muted-foreground">
          Gelephu experience centre
        </p>
        <h1 className="max-w-2xl text-5xl leading-tight tracking-tight md:text-6xl">
          Let your hope lead
          <br />
          to a new <em>discovery.</em>
        </h1>
        <p className="mb-14 mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Four chambers. Four ways to imagine a shared future. Follow the theme
          that speaks to you, and bring your own perspective to the journey.
        </p>
        <ChamberExplorer />
        <div className="grid gap-5 md:grid-cols-2">
          {Object.entries(chambers).map(([key, name]) => {
            const id = Number(key) as keyof typeof chambers,
              detail = chamberDetails[id];
            return (
              <section
                id={`chamber-${id}`}
                key={id}
                className="scroll-mt-6 rounded-2xl bg-card p-7 md:p-9"
              >
                <div className="mb-10 flex items-center justify-between">
                  <span className="serif text-5xl text-muted-foreground">
                    0{id}
                  </span>
                  <Compass
                    size={25}
                    strokeWidth={1}
                    className="text-muted-foreground"
                  />
                </div>
                <p className="eyebrow mb-3 text-[9px] text-muted-foreground">
                  {detail.eyebrow}
                </p>
                <h2 className="mb-4 text-3xl">{name}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {detail.description}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {detail.location}
                </p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {themes
                    .filter((theme) => theme.chamber === id)
                    .map((theme) => (
                      <Link
                        key={theme.id}
                        href={`/join?theme=${theme.id}`}
                        className="rounded-full bg-muted px-3 py-2 text-[10px]"
                      >
                        {theme.short} <span aria-hidden="true">&#8599;</span>
                      </Link>
                    ))}
                </div>
              </section>
            );
          })}
        </div>
        <p className="mt-6 max-w-2xl text-[10px] leading-relaxed text-muted-foreground">
          Chamber numbers and exhibit names follow the supplied
          experience-centre blueprint. The connections between your hope and an
          exhibit are suggested pathways.
        </p>
        <div className="mt-12 text-center">
          <Button asChild size="lg">
            <Link href="/join">
              What future will you grow? <ArrowUpRight size={17} />
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
