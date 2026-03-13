import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AIConfigForm } from "@/components/settings/AIConfigForm";
import { maskApiKey } from "@/lib/encryption";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aiConfigs } = await supabase
    .from("ai_configs")
    .select("id, provider, api_key_encrypted, model_preference")
    .eq("user_id", user.id);

  // Return masked key data safe to pass to client
  const maskedConfigs = (aiConfigs ?? []).map((c) => ({
    id: c.id,
    provider: c.provider,
    maskedKey: maskApiKey(c.api_key_encrypted),
    model_preference: c.model_preference,
  }));

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Configure your AI API keys and preferences
        </p>
      </div>

      <AIConfigForm
        existingConfigs={maskedConfigs}
        userEmail={user.email ?? ""}
      />
    </div>
  );
}
