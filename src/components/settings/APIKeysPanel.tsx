"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Code2, Copy, Check, Trash2, Plus, AlertTriangle } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
};

export function APIKeysPanel({ keys }: { keys: ApiKey[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to create key");
      return;
    }
    setGeneratedKey(json.key);
    setNewKeyName("");
    router.refresh();
  };

  const handleCopy = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    setRevoking(null);
    router.refresh();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            API Access
          </CardTitle>
          <CardDescription>
            Use API keys to connect Make, n8n, or any tool without logging in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing keys */}
          {keys.length > 0 && (
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{k.name}</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {k.key_prefix}••••••••
                      </code>
                      {k.last_used_at ? (
                        <span className="text-xs text-muted-foreground">
                          Last used {new Date(k.last_used_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never used</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={k.active ? "secondary" : "outline"} className="text-xs">
                      {k.active ? "Active" : "Revoked"}
                    </Badge>
                    {k.active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevoke(k.id)}
                        loading={revoking === k.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create new key */}
          <div className="space-y-2">
            <Label>New API Key</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Make Automation, n8n Workflow"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Button
                variant="outline"
                onClick={handleCreate}
                loading={creating}
                disabled={!newKeyName.trim()}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Generate
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {/* Usage hint */}
          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Usage</p>
            <code className="block">Authorization: Bearer cfp_your_key</code>
            <code className="block">POST {"{app_url}"}/api/v1/clients</code>
          </div>
        </CardContent>
      </Card>

      {/* One-time key reveal modal */}
      <Dialog open={!!generatedKey} onOpenChange={() => setGeneratedKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              API Key Generated
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              Copy this key now — it won&apos;t be shown again.
            </div>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-muted p-3 rounded-lg break-all select-all">
                {generatedKey}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={() => setGeneratedKey(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
