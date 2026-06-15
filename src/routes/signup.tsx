import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auth } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Create account — Zoobalo" }] }),
});

const DEPARTMENTS = [
  { value: "skincare",  label: "Procurement and Operations" },
  { value: "sales",     label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "crm",       label: "CRM" },
  { value: "creative",  label: "Creative Department" },
  { value: "hr",        label: "HR" },
  { value: "finance",   label: "Finance" },
  { value: "logistics", label: "Logistics and Inventory" },
  { value: "d2c",       label: "D2C" },
] as const;

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "" });
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (!form.department) { toast.error("Please select your department"); return; }
    setLoading(true);
    try {
      const res = await auth.signup(form.name, form.email, form.password, form.department);
      if (res.error) { toast.error(res.error); return; }
      if (res.pending) {
        setPending(true);
        return;
      }
      saveSession(res.token, res.user);
      toast.success(`Welcome, ${res.user.name}!`);
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (pending) {
    return (
      <AuthShell
        title="Request submitted"
        subtitle=""
        footer={<>Already have an account? <Link to="/login" search={{ redirect: undefined }} className="font-medium text-primary hover:underline">Sign in</Link></>}
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-2">
          <p className="font-medium">Your account request has been submitted.</p>
          <p>An admin will review and approve your account. You will be able to log in once approved.</p>
        </div>
        <Button variant="outline" className="w-full mt-4" asChild>
          <Link to="/login" search={{ redirect: undefined }}>Go to sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join your Zoobalo workspace"
      footer={<>Already have an account? <Link to="/login" search={{ redirect: undefined }} className="font-medium text-primary hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select your department" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" minLength={8} />
          <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Submitting…" : "Request access"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Your account will be active after admin approval.</p>
      </form>
    </AuthShell>
  );
}
