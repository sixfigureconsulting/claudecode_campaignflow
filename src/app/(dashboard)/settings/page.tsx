import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AIConfigForm } from "@/components/settings/AIConfigForm";
import { APIKeysPanel } from "@/components/settings/APIKeysPanel";
import { GlobalIntegrationsForm } from "@/components/settings/GlobalIntegrationsForm";
import { maskApiKey, decryptApiKey } from "@/lib/encryption";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aiConfigs } = await supabase
    .from("ai_configs")
    .select("id, provider, api_key_encrypted, model_preference")
    .eq("user_id", user.id);

  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, active, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const maskedConfigs = (aiConfigs ?? []).map((c) => {
    let maskedKey = "••••••••";
    try { maskedKey = maskApiKey(decryptApiKey(c.api_key_encrypted)); } catch {}
    return { id: c.id, provider: c.provider, maskedKey, model_preference: c.model_preference };
  });

  // Fetch global integration keys (stored under __integrations__ project)
  let integrationConfigs: Array<{ service: string; masked_key: string; updated_at: string }> = [];
  try {
    // Find the __integrations__ project if it exists
    const { data: defaultClient } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "__default__")
      .single();

    if (defaultClient) {
      const { data: intProject } = await supabase
        .from("projects")
        .select("id")
        .eq("client_id", defaultClient.id)
        .eq("name", "__integrations__")
        .single();

      if (intProject) {
        const { data: configs } = await supabase
          .from("integration_configs")
          .select("service, api_key_encrypted, updated_at")
          .eq("project_id", intProject.id);

        integrationConfigs = (configs ?? []).map((c) => {
          let masked_key = "••••••••";
          try { masked_key = maskApiKey(decryptApiKey(c.api_key_encrypted)); } catch {}
          return { service: c.service, masked_key, updated_at: c.updated_at };
        });
      }
    }
  } catch {}

  return (
    <div className="space-y-10 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your integrations, AI keys, and account preferences.
        </p>
      </div>

      {/* Integrations */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your outbound tools. Keys are shared across all campaigns.
          </p>
        </div>
        <GlobalIntegrationsForm existingConfigs={integrationConfigs} />
      </section>

      {/* AI config */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">AI Configuration</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add your AI provider key to enable sequence generation and lead qualification.
          </p>
        </div>
        <AIConfigForm existingConfigs={maskedConfigs} userEmail={user.email ?? ""} />
      </section>

      {/* API Keys */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate keys to access CampaignFlow via the REST API.
          </p>
        </div>
        <APIKeysPanel keys={apiKeys ?? []} />
      </section>
    </div>
  );
}
