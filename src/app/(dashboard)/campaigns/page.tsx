import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AddCampaignDialog } from "@/components/campaigns/AddCampaignDialog";
import { CampaignsList } from "@/components/campaigns/CampaignsList";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch campaigns — filter hidden system projects in JS (Supabase can't neq on joined cols)
  const { data: rawCampaigns } = await supabase
    .from("projects")
    .select("*, clients!inner(user_id, name), reports(id)")
    .eq("clients.user_id", user.id)
    .order("created_at", { ascending: false });

  const campaigns = (rawCampaigns ?? []).filter(
    (c: any) => c.name !== "__integrations__" && c.name !== "__standalone__" && c.clients?.name !== "__standalone__"
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Your outbound campaigns
          </p>
        </div>
        <AddCampaignDialog />
      </div>

      <CampaignsList campaigns={campaigns ?? []} />
    </div>
  );
}
