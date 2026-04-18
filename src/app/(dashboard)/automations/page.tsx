import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AutomationsClient } from "@/components/automations/AutomationsClient";

export const metadata: Metadata = { title: "Comment-to-DM Automations | CampaignFlow Pro" };

export default async function AutomationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: automations } = await supabase
    .from("comment_automations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: manychatConn } = await supabase
    .from("oauth_connections")
    .select("id, platform_username")
    .eq("user_id", user.id)
    .eq("platform", "manychat")
    .single();

  return (
    <AutomationsClient
      initialAutomations={automations ?? []}
      hasManyChat={!!manychatConn}
      manychatUsername={manychatConn?.platform_username ?? null}
    />
  );
}
