"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { projectSchema, type ProjectFormData } from "@/lib/validations";
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

const PROJECT_TYPES = [
  { value: "outbound", label: "Outbound" },
  { value: "seo", label: "SEO" },
  { value: "ads", label: "Paid Ads" },
  { value: "social", label: "Social Media" },
  { value: "email", label: "Email Marketing" },
  { value: "custom", label: "Custom" },
];

export function AddProjectDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: { project_type: "custom" },
  });

  const onSubmit = async (data: ProjectFormData) => {
    setError(null);
    const supabase = createClient();

    const { error: insertError } = await supabase.from("projects").insert({
      client_id: clientId,
      name: data.name,
      project_type: data.project_type,
      description: data.description || null,
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
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Project Name *</Label>
            <Input
              id="proj-name"
              placeholder="Q1 Google Ads Campaign"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Project Type *</Label>
            <Select
              defaultValue="custom"
              onValueChange={(v) => setValue("project_type", v as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea
              id="proj-desc"
              placeholder="Brief description of the project scope..."
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
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
