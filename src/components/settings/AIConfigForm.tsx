"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { aiConfigSchema, type AIConfigFormData } from "@/lib/validations";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Key, CheckCircle2, AlertCircle, Shield } from "lucide-react";

const AI_MODELS = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o (Recommended)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Faster/Cheaper)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  ],
  anthropic: [
    { value: "claude-opus-4-6", label: "Claude Opus 4.6 (Most Capable)" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Balanced)" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fast)" },
  ],
};

export function AIConfigForm({
  existingConfigs,
  userEmail,
}: {
  existingConfigs: Array<{
    id: string;
    provider: string;
    maskedKey: string;
    model_preference: string | null;
  }>;
  userEmail: string;
}) {
  const router = useRouter();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"openai" | "anthropic">("openai");

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AIConfigFormData>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: { provider: "openai" },
  });

  const onSubmit = async (data: AIConfigFormData) => {
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/settings/ai-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Failed to save");
      return;
    }

    setSuccess(`${data.provider === "openai" ? "OpenAI" : "Anthropic"} API key saved successfully`);
    reset();
    router.refresh();
  };

  const existingOpenAI = existingConfigs.find((c) => c.provider === "openai");
  const existingAnthropic = existingConfigs.find((c) => c.provider === "anthropic");

  return (
    <div className="space-y-5">
      {/* Current keys */}
      {existingConfigs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              Configured API Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {existingOpenAI && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">OpenAI</span>
                  <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded max-w-[200px] truncate">
                    {existingOpenAI.maskedKey}
                  </code>
                </div>
                {existingOpenAI.model_preference && (
                  <Badge variant="secondary" className="text-xs">
                    {existingOpenAI.model_preference}
                  </Badge>
                )}
              </div>
            )}
            {existingAnthropic && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Anthropic</span>
                  <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded max-w-[200px] truncate">
                    {existingAnthropic.maskedKey}
                  </code>
                </div>
                {existingAnthropic.model_preference && (
                  <Badge variant="secondary" className="text-xs">
                    {existingAnthropic.model_preference}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/update key */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add / Update API Key</CardTitle>
          <CardDescription>
            Your API key is encrypted with AES-256 before storage. It is never logged or exposed in responses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {success && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            )}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                value={selectedProvider}
                onValueChange={(v) => {
                  setSelectedProvider(v as any);
                  setValue("provider", v as any);
                  setValue("model_preference", "");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>API Key</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder={selectedProvider === "openai" ? "sk-..." : "sk-ant-..."}
                  className="pl-9"
                  error={errors.api_key?.message}
                  {...register("api_key")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Preferred Model</Label>
              <Select onValueChange={(v) => setValue("model_preference", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Use default model" />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS[selectedProvider].map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              <Shield className="h-4 w-4 shrink-0" />
              Stored encrypted · Never transmitted to third parties · Only used for your own AI calls
            </div>

            <Button type="submit" variant="gradient" className="w-full" loading={isSubmitting}>
              Save API Key
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-100 text-brand-700 rounded-xl flex items-center justify-center font-bold">
              {userEmail[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{userEmail}</p>
              <p className="text-xs text-muted-foreground">Account email</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
