import Link from "next/link";
import { Sprout, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="GM Tree home"
      className="group inline-flex items-center gap-2.5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-sm transition-transform duration-300 group-hover:rotate-[-7deg] group-hover:scale-105">
        <Sprout size={19} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[15px] font-semibold leading-none tracking-tight">
          GM Tree
        </span>
        {!compact && (
          <span className="mt-1 block whitespace-nowrap text-[10px] leading-none text-foreground">
            Gelephu Mindfulness Tree
          </span>
        )}
      </span>
    </Link>
  );
}

const navLinks = [
  { href: "/", label: "The experience" },
  { href: "/chambers", label: "Four chambers" },
  { href: "/display", label: "Live tree" },
];

export function SiteHeader({ pathname = "/" }: { pathname?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/82 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Brand />
        <nav
          aria-label="Main navigation (desktop)"
          className="hidden items-center gap-1 md:flex"
        >
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname === href
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/privacy"
            className="hidden rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:block"
          >
            Privacy
          </Link>
          <Button asChild size="sm">
            <Link href="/join">
              Add a hope <ArrowUpRight size={14} />
            </Link>
          </Button>
        </div>
      </div>
      <nav
        aria-label="Main navigation (mobile)"
        className="flex items-center gap-1 overflow-x-auto border-t border-border/70 px-2 py-2 md:hidden"
      >
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              pathname === href
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:px-6">
        <div>
          <Brand />
          <p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">
            Rooted in values. Growing through people. A living canopy of the
            hopes people carry for Gelephu Mindfulness City.
          </p>
        </div>
        <FooterColumn
          title="Experience"
          links={[
            ["/", "The experience"],
            ["/chambers", "Four chambers"],
            ["/display", "Live tree"],
          ]}
        />
        <FooterColumn
          title="Take part"
          links={[
            ["/join", "Add a hope"],
            ["/privacy", "Participation & privacy"],
          ]}
        />
        <FooterColumn
          title="Console"
          links={[
            ["/admin", "Staff console"],
            ["/tree", "Tree studio"],
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground md:px-6">
          <span>Gelephu Mindfulness Tree</span>
          <span>A hackathon prototype · Gelephu experience centre</span>
        </div>
      </div>
    </footer>
  );
}
