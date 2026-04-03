"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { projectSchema, type ProjectFormData } from "@/lib/validations";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

const PROJECT_TYPES = [
  { value: "cold_email", label: "Cold Email" },
  { value: "linkedin", label: "LinkedIn Outreach" },
  { value: "multi_channel", label: "Multi-Channel Sequence" },
  { value: "cold_call", label: "Cold Calling" },
  { value: "custom", label: "Custom" },
];

interface EditProjectDialogProps {
  project: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProjectDialog({ project, open, onOpenChange }: EditProjectDialogProps) {
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
    defaultValues: {
      name: project.name ?? "",
      project_type: project.project_type ?? "custom",
      description: project.description ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: project.name ?? "",
        project_type: project.project_type ?? "custom",
        description: project.description ?? "",
      });
      setError(null);
    }
  }, [open, project, reset]);

  const onSubmit = async (data: ProjectFormData) => {
    setError(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        project_type: data.project_type,
        description: data.description || null,
      }),
    });

    if (res.ok) {
      toast({ title: "Project updated", variant: "success" });
      onOpenChange(false);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to update project");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-proj-name">Project Name *</Label>
            <Input
              id="edit-proj-name"
              placeholder="Q1 Cold Email — SaaS Decision Makers"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Project Type *</Label>
            <Select
              defaultValue={project.project_type ?? "custom"}
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
            <Label htmlFor="edit-proj-desc">Description</Label>
            <Textarea
              id="edit-proj-desc"
              placeholder="Brief description of the project scope..."
              className="h-20"
              error={errors.description?.message}
              {...register("description")}
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
