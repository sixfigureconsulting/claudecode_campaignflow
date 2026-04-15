import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey, maskApiKey } from "@/lib/encryption";
import { z } from "zod";

const createAccountSchema = z.object({
  provider: z.enum(["gmail", "linkedin", "manychat", "form"]),
  account_label: z.string().min(1).max(80),
  email: z.string().email().optional(),
  api_key: z.string().optional(), // for manychat/linkedin (stored encrypted)
});

// GET /api/inbox/accounts — list connected accounts
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("inbox_accounts")
    .select("id, provider, account_label, email, extra_config, is_active, last_synced_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data ?? [] });
}

// POST /api/inbox/accounts — add a new connected account
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { provider, account_label, email, api_key } = parsed.data;

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    provider,
    account_label,
    email: email ?? null,
  };

  // For API-key-based providers, encrypt and store in access_token_encrypted
  if (api_key) {
    insertData.access_token_encrypted = encryptApiKey(api_key);
    insertData.extra_config = { masked_key: maskApiKey(api_key) };
  }

  // For 'form' provider, generate a webhook token
  if (provider === "form") {
    const webhookToken = crypto.randomUUID();
    insertData.extra_config = { webhook_token: webhookToken };
  }

  const { data, error } = await supabase
    .from("inbox_accounts")
    .insert(insertData)
    .select("id, provider, account_label, email, extra_config, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data }, { status: 201 });
}
