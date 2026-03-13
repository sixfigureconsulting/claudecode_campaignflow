"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { clientSchema, type ClientFormData } from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

interface EditClientDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client.name ?? "",
      industry: client.industry ?? "",
      website: client.website ?? "",
      primary_offer: client.primary_offer ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: client.name ?? "",
        industry: client.industry ?? "",
        website: client.website ?? "",
        primary_offer: client.primary_offer ?? "",
      });
      setError(null);
    }
  }, [open, client, reset]);

  const onSubmit = async (data: ClientFormData) => {
    setError(null);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        industry: data.industry || null,
        website: data.website || null,
        primary_offer: data.primary_offer || null,
      }),
    });

    if (res.ok) {
      toast({ title: "Client updated", variant: "success" });
      onOpenChange(false);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to update client");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Client Name *</Label>
            <Input
              id="edit-name"
              placeholder="Acme Corp"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-industry">Industry</Label>
            <Input
              id="edit-industry"
              placeholder="E.g. SaaS, E-commerce, Real Estate"
              error={errors.industry?.message}
              {...register("industry")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-website">Website</Label>
            <Input
              id="edit-website"
              placeholder="https://example.com"
              error={errors.website?.message}
              {...register("website")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-offer">Primary Offer</Label>
            <Textarea
              id="edit-offer"
              placeholder="What they sell and who they sell it to..."
              className="h-20"
              error={errors.primary_offer?.message}
              {...register("primary_offer")}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
