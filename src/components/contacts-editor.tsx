import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { ApiContact } from "@/lib/api";

const EMPTY_CONTACT: ApiContact = { department: "", name: "", mobile: "", email: "" };

const DEPARTMENTS = [
  "Accounts / Finance",
  "Purchase / Procurement",
  "Production",
  "Quality Control",
  "Logistics / Dispatch",
  "Sales",
  "Management",
  "Other",
];

interface Props {
  contacts: ApiContact[];
  onChange: (contacts: ApiContact[]) => void;
}

export function ContactsEditor({ contacts, onChange }: Props) {
  const add = () => onChange([...contacts, { ...EMPTY_CONTACT }]);

  const remove = (i: number) => onChange(contacts.filter((_, idx) => idx !== i));

  const update = (i: number, field: keyof ApiContact, value: string) =>
    onChange(contacts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Department Contacts</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />Add Contact
        </Button>
      </div>

      {contacts.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No contacts added yet. Click "Add Contact" to add department-wise contacts.
        </p>
      )}

      <div className="space-y-3">
        {contacts.map((c, i) => (
          <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <select
                value={c.department}
                onChange={(e) => update(i, "department", e.target.value)}
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select department…</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
                onClick={() => remove(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Contact name"
                value={c.name}
                onChange={(e) => update(i, "name", e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="Mobile"
                value={c.mobile}
                onChange={(e) => update(i, "mobile", e.target.value)}
                className="text-sm"
              />
            </div>
            <Input
              placeholder="Email address"
              value={c.email}
              onChange={(e) => update(i, "email", e.target.value)}
              className="text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
