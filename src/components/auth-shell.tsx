import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/70 p-10 text-primary-foreground lg:flex">
        <Link to="/login" search={{ redirect: undefined }} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-foreground/15 backdrop-blur">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Zoobalo</span>
        </Link>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight">
            Run procurement, inventory, and production for your skincare brand from one calm dashboard.
          </h2>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/80">
            Track 20+ SKUs, dozens of vendors, multi-stage production batches, and every shrink-wrap roll in transit — without spreadsheets.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-4 text-sm">
            <div><div className="text-2xl font-semibold">98.4%</div><div className="text-primary-foreground/70">QC pass rate</div></div>
            <div><div className="text-2xl font-semibold">38d</div><div className="text-primary-foreground/70">Avg lead time</div></div>
            <div><div className="text-2xl font-semibold">12+</div><div className="text-primary-foreground/70">Manufacturers</div></div>
          </div>
        </div>
        <p className="text-xs text-primary-foreground/60">© 2026 Zoobalo · For skincare manufacturing teams</p>
      </div>
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div>
            <span className="text-lg font-semibold">Zoobalo</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
