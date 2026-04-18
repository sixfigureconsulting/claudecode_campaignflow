# CampaignFlow Pro — Claude Code Context

This file is the single source of truth for resuming development across sessions.
Read this at the start of every session before touching any code.

---

## Project Overview

**CampaignFlow Pro** — a multi-channel outreach automation SaaS.
Stack: Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Postgres + Auth + RLS), Vercel.

**Active branch:** `claude/vigilant-turing-2tewM`
**Repo:** `sixfigureconsulting/claudecode_campaignflow`

---

## Architecture

```
src/
  app/
    (dashboard)/          # All protected pages (layout wraps Sidebar + TopBar)
      dashboard/          # Main dashboard
      campaigns/          # Email/social campaigns
      lists/              # Lead list builder (scraping integrations)
      reports/            # Campaign reports + social campaign stats
      super-dm-setter/    # AI message sequence generator
      inbox/              # Unified inbox (Gmail, LinkedIn, ManyChat, Forms)
      automations/        # Comment-to-DM automations (Instagram + Facebook)
      billing/            # Credits + transaction history + Stripe
      settings/           # User + integration settings
    api/                  # All API routes
  components/
    dashboard/            # Sidebar, TopBar
    campaigns/            # Campaign UI
    lists/                # ListsPanel (lead import UI)
    reports/              # ReportsClient, SocialCampaignStatsTable
    inbox/                # InboxClient, SyncAccountsModal
    automations/          # AutomationsClient
    billing/              # CreditTransactionHistory
    super-dm-setter/      # SuperDMSetterClient
    ui/                   # shadcn/ui primitives
  lib/
    supabase/             # client.ts + server.ts
    credits/              # index.ts — CREDIT_COSTS map + deductCredits
    encryption/           # AES-256 for API key storage
    api/                  # get-integration-config.ts (getGlobalApiConfig)
  hooks/                  # useToast (global event bus toast)
  types/                  # database.ts — all Supabase table types
supabase/
  migrations/             # 001–012 applied. 013 is next (Super Agent)
```

---

## Key Patterns

### Auth
All dashboard pages: `createClient()` from `@/lib/supabase/server` → `supabase.auth.getUser()` → redirect to `/login` if null.

### API Keys / Integration Config
User API keys stored encrypted in `integration_configs` table.
Always use `getGlobalApiConfig(supabase, userId, "provider")` + `getApiKey(config)` — never read env vars for user-supplied keys.

### Credits
```ts
import { CREDIT_COSTS, deductCredits } from "@/lib/credits";
await deductCredits(supabase, userId, "action_name", CREDIT_COSTS.action_name);
```
Credit balance displayed in TopBar via `creditBalance` prop from dashboard layout.

### Toast
```ts
import { toast } from "@/hooks/useToast";
toast({ title: "...", description: "...", variant: "default" | "destructive" });
```

### Encryption
```ts
import { encryptApiKey, decryptApiKey } from "@/lib/encryption";
```

### AI (Anthropic SDK)
`@anthropic-ai/sdk` v0.36.3 installed. User's Anthropic key stored in `ai_configs` table under `__integrations__` project. Look up via `getGlobalApiConfig(supabase, userId, "anthropic")`.

Default model: **`claude-opus-4-7`** with `thinking: { type: "adaptive" }`.

---

## Database — Key Tables

| Table | Purpose |
|---|---|
| `user_credits` | balance, plan, period per user |
| `credit_transactions` | debit/credit ledger |
| `integration_configs` | encrypted API keys (Apollo, HeyReach, Instantly, PhantomBuster, etc.) |
| `ai_configs` | encrypted Anthropic/OpenAI keys |
| `lead_lists` | list metadata (name, source, lead_count) |
| `lead_list_contacts` | individual leads per list |
| `campaigns` | email/outreach campaign configs |
| `social_campaigns` | social DM campaigns (sent_count, reply_count, failed_count) |
| `comment_automations` | Instagram/Facebook comment-to-DM rules (migration 012) |
| `inbox_accounts` | connected inbox channels (Gmail, LinkedIn, ManyChat, Form) |
| `inbox_conversations` | thread-level conversations with AI classification |
| `inbox_messages` | individual messages per conversation |
| `inbox_settings` | per-user ICP + classification config |
| `oauth_connections` | OAuth tokens (ManyChat, Reddit, Twitter, etc.) |

**Next migration:** `013_super_agent.sql` (not yet created)

---

## Lead Scraping Integrations (`/api/lists/scrape`)

All user API keys stored in DB — none in env vars.

| Source | Notes |
|---|---|
| Apollo | Saved list URL or list ID, paginates up to 500 |
| Apify | Dataset URL or actor run URL, 20+ column mappings |
| PhantomBuster | Agent URL, multi-fallback (output → resultObject → S3). **S3 domain is `cache.phantombuster.com`** (not `cache1`) |
| Hunter.io | Domain search, paginated |
| HubSpot | List memberships paginated via `after` cursor + batch/read in 100-contact chunks |
| Google Sheets | Public CSV export URL |
| CSV | Client-side parsing in `ListsPanel.tsx` |

---

## Current Sprint — Super AI Agent

**Status:** Designed, not yet built. All 10 tasks added to Notion Dev Pipeline.

### What It Is
A `/super-agent` page with a ChatGPT-style interface. User describes their offer + ICP → agent autonomously builds lead lists, generates sequences, creates campaigns + automations → presents an **Outreach Plan** for approval before anything launches.

### Files to Create

```
supabase/migrations/013_super_agent.sql
src/app/(dashboard)/super-agent/page.tsx
src/app/api/super-agent/sessions/route.ts
src/app/api/super-agent/sessions/[id]/route.ts
src/app/api/super-agent/stream/route.ts          ← core SSE agent loop
src/app/api/super-agent/approve/route.ts
src/lib/super-agent/agent-loop.ts                ← Claude tool-use loop
src/lib/super-agent/tools.ts                     ← 5 tool executors
src/lib/super-agent/system-prompt.ts
src/components/super-agent/SuperAgentClient.tsx  ← 3-view state machine
src/components/super-agent/AgentIntakeForm.tsx
src/components/super-agent/AgentProgressBar.tsx
src/components/super-agent/AgentMessageList.tsx
src/components/super-agent/ToolStepCard.tsx
src/components/super-agent/OutreachPlanReview.tsx
```

### DB Migration 013 — Tables

**`super_agent_sessions`**
```sql
id UUID PK, user_id UUID FK auth.users,
offer TEXT, icp TEXT, goals TEXT, channels TEXT[],
status TEXT DEFAULT 'running',  -- running|awaiting_approval|approved|launched|failed
outreach_plan JSONB,
created_list_ids UUID[], created_campaign_ids UUID[], created_automation_ids UUID[],
input_tokens INT DEFAULT 0, output_tokens INT DEFAULT 0,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

**`super_agent_messages`**
```sql
id UUID PK, session_id UUID FK super_agent_sessions, user_id UUID FK auth.users,
role TEXT,  -- user|assistant|tool_result
content JSONB,  -- raw Anthropic ContentBlock array
display_type TEXT,  -- user_message|agent_thinking|tool_start|tool_result|plan_ready
display_data JSONB,
created_at TIMESTAMPTZ
```

Both tables: RLS `auth.uid() = user_id`, index on user_id, updated_at trigger on sessions.

### Credit Costs (add to `src/lib/credits/index.ts`)
```ts
super_agent_session: 50,    // flat fee per run
super_agent_tool_call: 5,   // per tool execution
```

### Agent Flow (SSE stream route)
```
GET /api/super-agent/stream?sessionId=<uuid>
Content-Type: text/event-stream
export const maxDuration = 300;

1. Auth + load session from DB
2. Build messages array from super_agent_messages
3. Open ReadableStream, return Response immediately
4. Inside stream:
   a. client.messages.create({ model: 'claude-opus-4-7', thinking: { type: 'adaptive' }, tools, messages })
   b. ThinkingBlock → emit agent_thinking
   c. TextBlock → emit agent_text
   d. ToolUseBlock → emit tool_start → execute tool → deduct 5 credits → emit tool_result + credits_update
   e. Persist turn to super_agent_messages
   f. stop_reason === 'tool_use' → loop; stop_reason === 'end_turn' → emit plan_ready → emit done
```

### 5 Agent Tools
| Tool | Calls |
|---|---|
| `research_icp` | Direct Anthropic sub-call, returns structured ICP |
| `build_lead_list` | `src/app/api/lists/scrape` logic → persist to `lead_lists` |
| `generate_sequences` | Same logic as `/api/super-dm-setter/generate` |
| `create_campaign` | `POST /api/social/campaigns` with `status: 'draft'` |
| `create_comment_automation` | `POST /api/comment-automations` with `status: 'draft'` |

### SSE Events
| Event | Payload |
|---|---|
| `agent_thinking` | `{ text }` |
| `tool_start` | `{ callId, name, label, inputSummary }` |
| `tool_result` | `{ callId, name, label, success, resultSummary, leadCount? }` |
| `agent_text` | `{ text }` |
| `plan_ready` | `{ plan: OutreachPlan }` |
| `credits_update` | `{ remaining }` |
| `done` | `{ sessionId, status }` |

### UI State Machine
```
view: 'intake' → 'running' → 'review'

intake:  AgentIntakeForm (offer/ICP/goals textareas + channel pills)
         → POST /api/super-agent/sessions → open EventSource

running: AgentMessageList + AgentProgressBar
         EventSource pushes tool_start/tool_result as ToolStepCards
         plan_ready event → switch to 'review'

review:  OutreachPlanReview (toggle campaigns + automations)
         → POST /api/super-agent/approve → launch confirmation
```

### Build Order (start here next session)
1. `013_super_agent.sql` + credit costs + TypeScript types  **(P0)**
2. Sessions API routes  **(P1)**
3. Tool executor library  **(P1)**
4. Streaming agent loop  **(P1)**
5. Approval route  **(P1)**
6. Intake form + chat shell UI  **(P2)**
7. Message list + ToolStepCard  **(P2)**
8. OutreachPlanReview  **(P2)**
9. Sidebar + TopBar nav (Bot icon)  **(P2)**
10. Polish + edge cases  **(P3)**

---

## Completed Features (as of 2026-04-18)

| Feature | Key Files |
|---|---|
| Dashboard + Sidebar + TopBar | `src/components/dashboard/` |
| Campaigns | `src/app/(dashboard)/campaigns/` |
| Lead Lists + Scraping | `src/components/lists/ListsPanel.tsx`, `src/app/api/lists/` |
| Reports + Social Stats | `src/components/reports/`, `src/app/(dashboard)/reports/` |
| Super DM Setter | `src/app/(dashboard)/super-dm-setter/`, `src/app/api/super-dm-setter/` |
| Unified Inbox | `src/components/inbox/`, `src/app/(dashboard)/inbox/`, `src/app/api/inbox/` |
| Comment Automations | `src/components/automations/AutomationsClient.tsx`, `src/app/api/comment-automations/`, `src/app/api/webhooks/meta/` |
| Credit System | `src/lib/credits/`, `src/components/billing/CreditTransactionHistory.tsx` |
| Social Campaign Cards | `src/components/dashboard/SocialCampaignCards.tsx` |
| Low-Credit Warnings | `src/components/dashboard/TopBar.tsx` |

## Applied Migrations
- 001–012 applied
- **013 is next** — `supabase/migrations/013_super_agent.sql`

---

## Env Vars Needed (not yet set)
- `META_VERIFY_TOKEN` — for Meta webhook verification (`/api/webhooks/meta`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — for Gmail OAuth (inbox sync)

---

## Dev Logs
Full session-by-session history in `dev-logs/`. Most recent: `dev-logs/2026-04-18.md`.
