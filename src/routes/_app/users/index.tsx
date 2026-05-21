import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_app/users/")({
  loader: () => api.users.list(),
  pendingComponent: PageSkeleton,
  component: UsersPage,
  head: () => ({ meta: [{ title: "User Management — Zoobalo" }] }),
});

function UsersPage() {
  const users = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Team members and roles" actions={<Button><Plus className="mr-1.5 h-4 w-4" />Invite user</Button>} />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">User</th><th className="px-4 py-2.5 font-medium">Email</th><th className="px-4 py-2.5 font-medium">Role</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{u.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback></Avatar><span className="font-medium">{u.name}</span></div></td>
                <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2.5">{u.role}</td>
                <td className="px-4 py-2.5"><StatusBadge status={u.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
