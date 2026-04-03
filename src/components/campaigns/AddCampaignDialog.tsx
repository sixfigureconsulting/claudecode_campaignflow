"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { CAMPAIGN_TYPES } from "./campaignTypes";

const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(100),
  project_type: z.string().min(1),
  description: z.string().max(500).optional().or(z.literal("")),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

export function AddCampaignDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { project_type: "cold_email" },
  });

  const onSubmit = async (data: CampaignFormData) => {
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); return; }

    // Get or create a default "workspace" client for this user
    let clientId: string;
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "__default__")
      .single();

    if (existing) {
      clientId = existing.id;
    } else {
      const { data: created, error: clientErr } = await supabase
        .from("clients")
        .insert({ user_id: user.id, name: "__default__" })
        .select("id")
        .single();
      if (clientErr || !created) { setError("Failed to initialize workspace"); return; }
      clientId = created.id;
    }

    // Map new outbound-focused types to DB enum values (migration pending)
    const dbTypeMap: Record<string, string> = {
      cold_email: "email",
      linkedin: "outbound",
      multi_channel: "outbound",
      cold_call: "outbound",
      custom: "custom",
    };
    const dbType = dbTypeMap[data.project_type] ?? "custom";
    // Store the real subtype as a prefix in description
    const descPrefix = `[type:${data.project_type}]`;
    const description = data.description
      ? `${descPrefix} ${data.description}`
      : descPrefix;

    const { error: insertError } = await supabase.from("projects").insert({
      client_id: clientId,
      name: data.name,
      project_type: dbType,
      description,
    });

    if (insertError) { setError(insertError.message); return; }

    reset();
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient" size="sm">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Campaign Name *</Label>
            <Input
              id="campaign-name"
              placeholder="Q2 Cold Email — SaaS Founders"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Campaign Type *</Label>
            <Select
              defaultValue="cold_email"
              onValueChange={(v) => setValue("project_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-desc">Description</Label>
            <Textarea
              id="campaign-desc"
              placeholder="Target audience, goal, ICP..."
              className="h-20"
              error={errors.description?.message}
              {...register("description")}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={isSubmitting}>
              Create Campaign
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
