"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GitBranch, ExternalLink, FolderOpen, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";

interface Project {
  id: number;
  name: string;
  slug: string;
  repo_url: string | null;
  description: string | null;
  created_at: string;
  last_used_at: string | null;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 50);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formRepoUrl, setFormRepoUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [cloneProgress, setCloneProgress] = useState<Record<number, string[]>>({});
  const [cloning, setCloning] = useState<Record<number, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setProjects(data.projects);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!formName.trim()) {
      setFormError("Name is required");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          repo_url: formRepoUrl.trim() || undefined,
          description: formDescription.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create");
        return;
      }
      toast.success(`Project "${formName.trim()}" created`);
      setFormName("");
      setFormRepoUrl("");
      setFormDescription("");
      setShowForm(false);
      fetchProjects();
    } catch {
      setFormError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (project: Project) => {
    if (confirmDelete !== project.id) {
      setConfirmDelete(project.id);
      return;
    }
    setDeletingId(project.id);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(`Project "${project.name}" deleted`);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClone = async (project: Project) => {
    setCloning((prev) => ({ ...prev, [project.id]: true }));
    setCloneProgress((prev) => ({ ...prev, [project.id]: [] }));

    try {
      const res = await fetch(`/api/projects/${project.id}/clone`, { method: "POST" });
      if (!res.ok) {
        toast.error("Failed to start clone");
        setCloning((prev) => ({ ...prev, [project.id]: false }));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const msg = line.slice(6);
            if (msg === "done") {
              toast.success("Done!");
              setCloning((prev) => ({ ...prev, [project.id]: false }));
            } else if (msg.startsWith("error:")) {
              toast.error(msg.slice(6));
              setCloning((prev) => ({ ...prev, [project.id]: false }));
            } else {
              setCloneProgress((prev) => ({
                ...prev,
                [project.id]: [...(prev[project.id] || []), msg].slice(-5),
              }));
            }
          }
        }
      }
    } catch {
      toast.error("Clone failed");
      setCloning((prev) => ({ ...prev, [project.id]: false }));
    }
  };

  const handleOpenSession = (project: Project) => {
    router.push(`/?projectId=${project.id}`);
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex h-12 items-center gap-3 border-b border-border bg-background px-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back
        </Link>
        <h1 className="flex-1 text-sm font-semibold">Projects</h1>
        <Button size="sm" onClick={() => { setShowForm(true); setFormError(""); }}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="My App"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
                {formName && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Slug: <code className="font-mono">{generateSlug(formName)}</code>
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Git Repo URL (optional)
                </label>
                <Input
                  placeholder="https://github.com/user/repo.git"
                  value={formRepoUrl}
                  onChange={(e) => setFormRepoUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Description (optional)
                </label>
                <Input
                  placeholder="What is this project?"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              {formError && (
                <p className="text-xs text-destructive">{formError}</p>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm" onClick={handleCreate} disabled={submitting}>
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowForm(false); setFormError(""); }}
              >
                Cancel
              </Button>
            </CardFooter>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No projects yet.{" "}
            <button
              className="text-primary underline-offset-4 hover:underline"
              onClick={() => setShowForm(true)}
            >
              Create one
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <Card key={project.id} className="gap-3 py-4">
                <CardHeader className="py-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-[15px]">{project.name}</CardTitle>
                      <CardDescription className="mt-0.5 text-[11px] font-mono">
                        {project.slug}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {confirmDelete === project.id ? (
                        <>
                          <Button
                            size="icon-sm"
                            variant="destructive"
                            onClick={() => handleDelete(project)}
                            disabled={deletingId === project.id}
                            title="Confirm delete"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete(null)}
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleDelete(project)}
                          disabled={deletingId === project.id}
                          title="Delete project"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          {deletingId === project.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 py-0">
                  {project.description && (
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  )}
                  {project.repo_url && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate font-mono">{project.repo_url}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Last used: {formatDate(project.last_used_at)}
                  </p>
                  {cloneProgress[project.id]?.length > 0 && (
                    <div className="rounded-md bg-muted px-3 py-2 text-[11px] font-mono text-muted-foreground space-y-0.5">
                      {cloneProgress[project.id].map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="gap-2 py-0">
                  <Button
                    size="sm"
                    onClick={() => handleOpenSession(project)}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Open Session
                  </Button>
                  {project.repo_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleClone(project)}
                      disabled={cloning[project.id]}
                    >
                      {cloning[project.id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <GitBranch className="h-3.5 w-3.5" />
                      )}
                      {cloning[project.id] ? "Working..." : "Clone / Pull"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
