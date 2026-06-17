import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { api, type ApiFollowUpContact, type ApiFollowUpTask } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Edit2, PhoneCall } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/follow-ups/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    return { contacts: await api.followUps.list(sharedTeamId), sharedTeamId };
  },
  pendingComponent: PageSkeleton,
  component: FollowUpsPage,
  head: () => ({ meta: [{ title: "Follow Up — Zoobalo" }] }),
});

type Contact = ApiFollowUpContact & { tasks: ApiFollowUpTask[] };

const EMPTY_CONTACT = { name: "", phone: "", email: "", notes: "" };

function FollowUpsPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <FollowUpsContent contacts={data.contacts} sharedTeamId={data.sharedTeamId} />;
}

function FollowUpsContent({ contacts: initial, sharedTeamId }: { contacts: Contact[]; sharedTeamId?: string }) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [contacts, setContacts] = useState(initial);
  // Sync local state when the loader refreshes (after add/delete operations)
  useEffect(() => { setContacts(initial); }, [initial]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY_CONTACT);
  const [saving, setSaving] = useState(false);
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_CONTACT);
    setSheetOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" });
    setSheetOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.followUps.updateContact(editing.id, form);
        toast.success("Contact updated");
      } else {
        await api.followUps.createContact(form, sharedTeamId);
        toast.success("Contact added");
      }
      setSheetOpen(false);
      await reload();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm("Delete this contact and all their tasks?")) return;
    try {
      await api.followUps.deleteContact(id);
      toast.success("Contact deleted");
      await reload();
    } catch {
      toast.error("Delete failed");
    }
  };

  const addTask = async (contactId: string) => {
    const desc = (taskInputs[contactId] ?? "").trim();
    if (!desc) return;
    try {
      await api.followUps.createTask(contactId, { description: desc });
      setTaskInputs((p) => ({ ...p, [contactId]: "" }));
      await reload();
    } catch {
      toast.error("Failed to add task");
    }
  };

  const toggleTask = async (contactId: string, task: ApiFollowUpTask) => {
    const newDone = !task.done;
    const nowIso = new Date().toISOString();

    // Optimistic update — instant UI feedback
    setContacts((prev) =>
      prev.map((c) =>
        c.id !== contactId ? c : {
          ...c,
          tasks: c.tasks.map((t) =>
            t.id !== task.id ? t : { ...t, done: newDone, doneAt: newDone ? nowIso : null }
          ),
        }
      )
    );

    try {
      await api.followUps.updateTask(contactId, task.id, {
        done: newDone,
        doneAt: newDone ? nowIso : null,
      });
    } catch {
      // Roll back on failure
      setContacts((prev) =>
        prev.map((c) =>
          c.id !== contactId ? c : {
            ...c,
            tasks: c.tasks.map((t) =>
              t.id !== task.id ? t : { ...t, done: task.done, doneAt: task.doneAt }
            ),
          }
        )
      );
      toast.error("Update failed");
    }
  };

  const handleDeleteTask = async (contactId: string, taskId: string) => {
    try {
      await api.followUps.deleteTask(contactId, taskId);
      await reload();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Follow Up"
        description="Manage daily follow-ups with contacts"
        actions={
          <Button onClick={openAdd} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add Contact
          </Button>
        }
      />

      {contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <PhoneCall className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">No contacts yet. Add one to start tracking follow-ups.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {contacts.map((contact) => {
          const pendingCount = contact.tasks.filter((t) => !t.done).length;
          const doneCount = contact.tasks.filter((t) => t.done).length;
          return (
            <div key={contact.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-base leading-tight">{contact.name}</h3>
                  {contact.phone && <p className="text-sm text-muted-foreground mt-0.5">{contact.phone}</p>}
                  {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                  {contact.notes && <p className="mt-1 text-xs text-muted-foreground italic line-clamp-2">{contact.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(contact)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteContact(contact.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {(pendingCount > 0 || doneCount > 0) && (
                <div className="mt-2 flex gap-2 text-xs">
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      {pendingCount} pending
                    </span>
                  )}
                  {doneCount > 0 && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                      {doneCount} done
                    </span>
                  )}
                </div>
              )}

              {contact.tasks.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t pt-3">
                  {contact.tasks.map((task) => (
                    <li key={task.id} className="group flex items-start gap-2">
                      <Checkbox
                        id={task.id}
                        checked={task.done}
                        onCheckedChange={() => toggleTask(contact.id, task)}
                        className="mt-0.5 shrink-0"
                      />
                      <label
                        htmlFor={task.id}
                        className={cn(
                          "flex-1 cursor-pointer text-sm leading-snug",
                          task.done && "line-through text-muted-foreground"
                        )}
                      >
                        {task.description}
                      </label>
                      <Button
                        variant="ghost" size="icon"
                        className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteTask(contact.id, task.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Add a task..."
                  className="h-7 text-xs"
                  value={taskInputs[contact.id] ?? ""}
                  onChange={(e) => setTaskInputs((p) => ({ ...p, [contact.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") addTask(contact.id); }}
                />
                <Button size="sm" variant="outline" className="h-7 shrink-0 px-2" onClick={() => addTask(contact.id)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Contact" : "Add Contact"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Contact name"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email address"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Notes about this contact"
                rows={3}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={save} disabled={saving || !form.name.trim()} className="w-full">
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Contact"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
