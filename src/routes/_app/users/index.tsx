import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminApi, ApiPendingUser } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/users/")({
  loader: () => adminApi.listAll(),
  pendingComponent: PageSkeleton,
  component: UsersPage,
  head: () => ({ meta: [{ title: "User Management — Zoobalo" }] }),
});

const DEPT_LABEL: Record<string, string> = {
  skincare: "Skincare", creative: "Creative", hr: "HR",
  sales: "Sales", marketing: "Marketing", logistics: "Logistics",
};

function UsersPage() {
  const users = Route.useLoaderData() as ApiPendingUser[];
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);

  const pending = users.filter((u) => u.status === "Pending");
  const active  = users.filter((u) => u.status !== "Pending");

  const approve = async (id: string) => {
    setProcessing(id);
    try {
      const res = await adminApi.approveUser(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("User approved");
      router.invalidate();
    } finally { setProcessing(null); }
  };

  const reject = async (id: string) => {
    setProcessing(id);
    try {
      const res = await adminApi.rejectUser(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("User rejected");
      router.invalidate();
    } finally { setProcessing(null); }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="User Management" description="Manage team access and approvals" />

      {pending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-sm">Pending Approvals</h2>
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">{pending.length}</Badge>
          </div>
          <div className="rounded-xl border bg-amber-50/30 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Department</th>
                  <th className="px-4 py-2.5 font-medium">Requested</th>
                  <th className="px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{u.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback></Avatar>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{DEPT_LABEL[u.department] ?? u.department}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" disabled={processing === u.id} onClick={() => approve(u.id)}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" disabled={processing === u.id} onClick={() => reject(u.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-sm">All Users</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {active.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{u.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback></Avatar>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline">{DEPT_LABEL[u.department] ?? u.department}</Badge>
                  </td>
                  <td className="px-4 py-2.5">{u.role}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={u.status} /></td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No active users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
