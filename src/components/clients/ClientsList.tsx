"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getInitials } from "@/lib/utils";
import { Globe, Briefcase, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EditClientDialog } from "./EditClientDialog";
import { toast } from "@/components/ui/toast";

const PROJECT_TYPE_COLORS: Record<string, string> = {
  outbound: "bg-blue-100 text-blue-700",
  seo: "bg-green-100 text-green-700",
  ads: "bg-orange-100 text-orange-700",
  social: "bg-pink-100 text-pink-700",
  email: "bg-purple-100 text-purple-700",
  custom: "bg-gray-100 text-gray-700",
};

export function ClientsList({ clients }: { clients: any[] }) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editClient, setEditClient] = useState<any | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/clients/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Client deleted", variant: "success" });
      setDeleteId(null);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ title: body.error ?? "Failed to delete client", variant: "destructive" });
    }
  };

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
            <Briefcase className="h-8 w-8 text-brand-400" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No clients yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Add your first client to start tracking their campaign performance.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <div key={client.id} className="relative group/card">
              <Card className="h-full hover:shadow-md hover:border-brand-200 transition-all cursor-pointer group" onClick={() => router.push(`/clients/${client.id}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 bg-brand-100 text-brand-700 rounded-xl flex items-center justify-center text-base font-bold shrink-0">
                      {getInitials(client.name)}
                    </div>
                    <div className="flex-1 min-w-0 pr-7">
                      <h3 className="font-semibold truncate group-hover:text-brand-600 transition-colors">
                        {client.name}
                      </h3>
                      {client.industry && (
                        <p className="text-xs text-muted-foreground">{client.industry}</p>
                      )}
                    </div>
                  </div>

                  {client.primary_offer && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {client.primary_offer}
                    </p>
                  )}

                  {(client.projects ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {client.projects.slice(0, 3).map((p: any) => (
                        <span
                          key={p.id}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROJECT_TYPE_COLORS[p.project_type] ?? PROJECT_TYPE_COLORS.custom}`}
                        >
                          {p.name.slice(0, 14)}
                        </span>
                      ))}
                      {client.projects.length > 3 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          +{client.projects.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{client.projects?.length ?? 0} project{(client.projects?.length ?? 0) !== 1 ? "s" : ""}</span>
                    {client.website && (
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 hover:text-brand-600 transition-colors"
                      >
                        <Globe className="h-3 w-3" />
                        Website
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>

            {/* Actions menu — sits above the card */}
            <div
              className="absolute top-3 right-3 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/card:opacity-100 transition-opacity focus:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onSelect={() => setEditClient(client)}
                    className="gap-2"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setDeleteId(client.id)}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete client?"
        description="This will permanently delete the client and all their projects, reports, and metrics. This cannot be undone."
        onConfirm={handleDelete}
      />

      {editClient && (
        <EditClientDialog
          client={editClient}
          open={!!editClient}
          onOpenChange={(o) => !o && setEditClient(null)}
        />
      )}
    </>
  );
}
