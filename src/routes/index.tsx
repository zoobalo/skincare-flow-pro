import { createFileRoute, redirect } from "@tanstack/react-router";
import { getHomeRoute } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: getHomeRoute() }); },
});
