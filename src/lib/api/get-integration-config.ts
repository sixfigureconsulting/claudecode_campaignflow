import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Fetches and decrypts an integration config from the user's global
 * __integrations__ project. Multi-field configs (calling platforms) are
 * stored as JSON and returned as an object; single-key services return a string.
 */
export async function getGlobalApiConfig(
  supabase: SupabaseClient,
  userId: string,
  service: string
): Promise<string | Record<string, string> | null> {
  try {
    const { data: defaultClient } = await supabase
      .from("clients").select("id")
      .eq("user_id", userId).eq("name", "__default__").single();
    if (!defaultClient) return null;

    const { data: intProject } = await supabase
      .from("projects").select("id")
      .eq("client_id", defaultClient.id).eq("name", "__integrations__").single();
    if (!intProject) return null;

    const { data: config } = await supabase
      .from("integration_configs").select("api_key_encrypted")
      .eq("project_id", intProject.id).eq("service", service).single();
    if (!config) return null;

    const decrypted = decryptApiKey(config.api_key_encrypted);
    try {
      return JSON.parse(decrypted) as Record<string, string>;
    } catch {
      return decrypted;
    }
  } catch {
    return null;
  }
}

/** Extracts the api_key string from a config (handles both plain string and JSON object). */
export function getApiKey(config: string | Record<string, string> | null): string | null {
  if (!config) return null;
  if (typeof config === "string") return config;
  return config.api_key ?? null;
}
