import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ListsPanel } from "@/components/lists/ListsPanel";

export const metadata: Metadata = { title: "Lead Lists" };

export default async function ListsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lists } = await supabase
    .from("lead_lists")
    .select("id, name, source, lead_count, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Lead Lists</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Saved contact lists you can load into any campaign in one click.
        </p>
      </div>
      <ListsPanel initialLists={lists ?? []} />
    </div>
  );
}
