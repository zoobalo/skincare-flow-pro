import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
  head: () => ({ meta: [{ title: "Reset password — Zoobalo" }] }),
});

function ResetPage() {
  const navigate = useNavigate();
  return (
    <AuthShell title="Choose a new password" subtitle="At least 8 characters">
      <form onSubmit={(e) => { e.preventDefault(); navigate({ to: "/login", search: { redirect: undefined } }); }} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="p1">New password</Label><Input id="p1" type="password" required /></div>
        <div className="space-y-1.5"><Label htmlFor="p2">Confirm password</Label><Input id="p2" type="password" required /></div>
        <Button type="submit" className="w-full">Update password</Button>
      </form>
    </AuthShell>
  );
}
