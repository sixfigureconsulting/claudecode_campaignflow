import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClientsList } from "@/components/clients/ClientsList";
import { AddClientDialog } from "@/components/clients/AddClientDialog";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clients } = await supabase
    .from("clients")
    .select("*, projects(id, name, project_type)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your client portfolio
          </p>
        </div>
        <AddClientDialog />
      </div>

      <ClientsList clients={clients ?? []} />
    </div>
  );
}
