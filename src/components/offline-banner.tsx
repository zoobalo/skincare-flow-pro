import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const off = () => setOffline(true);
    const on  = () => setOffline(false);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    // Set initial state
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground md:bottom-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:rounded-full md:shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline — showing cached data</span>
    </div>
  );
}
