import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ListsPanel } from "@/components/lists/ListsPanel";
import { getGlobalApiConfig } from "@/lib/api/get-integration-config";

export const metadata: Metadata = { title: "Lead Lists" };

// Which services need a key to show "Connected" badge
const KEYED_SERVICES = ["apollo", "apify", "phantombuster", "hunter", "hubspot"];

export default async function ListsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [listsResult, ...keyChecks] = await Promise.all([
    supabase
      .from("lead_lists")
      .select("id, name, source, lead_count, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    ...KEYED_SERVICES.map((svc) => getGlobalApiConfig(supabase, user.id, svc)),
  ]);

  // Build list of services that have a key configured
  const connectedServices = KEYED_SERVICES.filter((_, i) => keyChecks[i] !== null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Lead Lists</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Build and manage your contact lists. Import from integrations, upload CSVs, or use these lists in any campaign.
        </p>
      </div>
      <ListsPanel initialLists={listsResult.data ?? []} connectedServices={connectedServices} />
    </div>
  );
}
