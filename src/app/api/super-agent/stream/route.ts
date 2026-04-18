import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAgentLoop } from "@/lib/super-agent/agent-loop";

export const maxDuration = 300; // 5 minutes — agent loops can be long

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response("sessionId is required", { status: 400 });
  }

  // Load session and verify ownership
  const { data: session, error: sessionError } = await supabase
    .from("super_agent_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return new Response("Session not found", { status: 404 });
  }

  if (session.status !== "running") {
    return new Response("Session is not in running state", { status: 409 });
  }

  // Detect which integrations the user has configured
  const availableIntegrations = await detectAvailableIntegrations(supabase, user.id);

  // Build the SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: unknown) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Controller may be closed if client disconnected
        }
      };

      try {
        await runAgentLoop({
          supabase,
          userId: user.id,
          sessionId,
          offer: session.offer as string,
          icp: session.icp as string,
          goals: session.goals as string,
          channels: session.channels as string[],
          availableIntegrations,
          emit,
        });
      } catch (err) {
        emit("error", { message: `Unexpected agent error: ${String(err)}` });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ── Detect available integrations ─────────────────────────────────────────────

async function detectAvailableIntegrations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Record<string, boolean>> {
  const { data: globalConfigs } = await supabase
    .from("global_api_configs")
    .select("service")
    .eq("user_id", userId);

  const services = new Set((globalConfigs ?? []).map((r: { service: string }) => r.service));

  return {
    apollo: services.has("apollo"),
    apify: services.has("apify"),
    hunter: services.has("hunter"),
    hubspot: services.has("hubspot"),
  };
}
