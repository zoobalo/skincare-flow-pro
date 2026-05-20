import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { FlaskConical } from "lucide-react";

export const Route = createFileRoute("/_app/npd/")({
  component: NpdPage,
  head: () => ({ meta: [{ title: "NPD — Zoobalo" }] }),
});

function NpdPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Product Development"
        description="R&D pipeline — formulations, trials, and launch planning"
      />
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-16 text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FlaskConical className="h-7 w-7" />
        </div>
        <div>
          <p className="font-semibold">NPD module coming soon</p>
          <p className="mt-1 text-sm text-muted-foreground">Fields and structure will be configured shortly.</p>
        </div>
      </div>
    </div>
  );
}
