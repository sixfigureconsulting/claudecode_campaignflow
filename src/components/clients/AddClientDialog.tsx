"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clientSchema, type ClientFormData } from "@/lib/validations";
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
import { Plus } from "lucide-react";

export function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({ resolver: zodResolver(clientSchema) });

  const onSubmit = async (data: ClientFormData) => {
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { error: insertError } = await supabase.from("clients").insert({
      user_id: user.id,
      name: data.name,
      industry: data.industry || null,
      website: data.website || null,
      primary_offer: data.primary_offer || null,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient" size="sm">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Client Name *</Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              placeholder="E.g. SaaS, E-commerce, Real Estate"
              error={errors.industry?.message}
              {...register("industry")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              placeholder="https://example.com"
              error={errors.website?.message}
              {...register("website")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="primary_offer">Primary Offer</Label>
            <Textarea
              id="primary_offer"
              placeholder="What they sell and who they sell it to..."
              className="h-20"
              error={errors.primary_offer?.message}
              {...register("primary_offer")}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={isSubmitting}>
              Create Client
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
