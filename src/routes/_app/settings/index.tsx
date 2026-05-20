import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Zoobalo" }] }),
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace preferences and account" />
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          <div className="grid max-w-xl gap-4 rounded-xl border bg-card p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First name</Label><Input defaultValue="Priya" /></div>
              <div className="space-y-1.5"><Label>Last name</Label><Input defaultValue="Ojha" /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input defaultValue="priya@skinops.demo" /></div>
            <div className="space-y-1.5"><Label>Role</Label><Input defaultValue="Procurement & Operations Manager" /></div>
            <div><Button>Save changes</Button></div>
          </div>
        </TabsContent>
        <TabsContent value="company" className="mt-4">
          <div className="grid max-w-xl gap-4 rounded-xl border bg-card p-5">
            <div className="space-y-1.5"><Label>Company name</Label><Input defaultValue="Skinful Naturals Pvt Ltd" /></div>
            <div className="space-y-1.5"><Label>GST</Label><Input defaultValue="27SKNFL5544A1Z9" /></div>
            <div className="space-y-1.5"><Label>Registered address</Label><Input defaultValue="Andheri MIDC, Mumbai, MH 400093" /></div>
            <div><Button>Save</Button></div>
          </div>
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <div className="max-w-xl space-y-3 rounded-xl border bg-card p-5">
            {[
              ["Low stock alerts","Get notified when a SKU drops below threshold"],
              ["PO approvals","Email when a PO needs your approval"],
              ["Production delays","Alert on delayed manufacturing batches"],
              ["Shipment updates","Get LR-level shipment status updates"],
            ].map(([t,d]) => (
              <div key={t} className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
                <div><div className="text-sm font-medium">{t}</div><div className="text-xs text-muted-foreground">{d}</div></div>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="appearance" className="mt-4">
          <div className="max-w-xl space-y-4 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div><div className="text-sm font-medium">Dark mode</div><div className="text-xs text-muted-foreground">Use a darker palette</div></div>
              <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
