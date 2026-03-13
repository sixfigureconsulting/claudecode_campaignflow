import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey } from "@/lib/encryption";
import { aiConfigSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = aiConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { provider, api_key, model_preference } = parsed.data;
    const encrypted = encryptApiKey(api_key);

    const { error: upsertError } = await supabase
      .from("ai_configs")
      .upsert(
        {
          user_id: user.id,
          provider,
          api_key_encrypted: encrypted,
          model_preference: model_preference || null,
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("AI config save error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider || !["openai", "anthropic"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    await supabase
      .from("ai_configs")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
