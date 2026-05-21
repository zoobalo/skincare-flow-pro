import { RefreshCw } from "lucide-react";

export function PullToRefreshIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed left-1/2 top-16 z-50 -translate-x-1/2 md:hidden">
      <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Refreshing…
      </div>
    </div>
  );
}
