import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  fetchProjects, fetchTasks, createProject, updateProject,
  createTask, updateTask, deleteTask,
} from "../lib/api";
import {
  Card, CardHeader, StatCard, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, Modal, FormField, FormGrid, StatusPill, ConfirmDialog,
} from "../components/ui/index";
import type { ProjectRow, TaskRow } from "../lib/types";

// ── Colors ─────────────────────────────────────────────────────────────────
const PROJECT_STATUS_COLOR: Record<string, string> = {
  Open:      "#6366f1",
  Completed: "#10b981",
  Overdue:   "#ef4444",
  Cancelled: "#9ca3af",
};

const TASK_STATUS_COLOR: Record<string, string> = {
  Open:             "#6366f1",
  Working:          "#f59e0b",
  Overdue:          "#ef4444",
  "Pending Review": "#0ea5e9",
  Completed:        "#10b981",
  Cancelled:        "#9ca3af",
  Template:         "#94a3b8",
};

const PRIORITY_COLOR: Record<string, string> = {
  Low:    "#94a3b8",
  Medium: "#f59e0b",
  High:   "#ef4444",
  Urgent: "#b91c1c",
};

// ── Gantt-style bar calculation ──────────────────────────────────────────
function dateToNum(d?: string): number {
  if (!d) return 0;
  return new Date(d).getTime();
}

function GanttTimeline({ tasks, rangeStart, rangeEnd }: {
  tasks: TaskRow[];
  rangeStart: number;
  rangeEnd: number;
}) {
  const rangeMs = rangeEnd - rangeStart || 1;

  const months = useMemo(() => {
    const arr: string[] = [];
    const d = new Date(rangeStart);
    while (d.getTime() <= rangeEnd) {
      arr.push(`${d.toLocaleString("default", { month: "short" })} '${String(d.getFullYear()).slice(2)}`);
      d.setMonth(d.getMonth() + 1);
    }
    return arr;
  }, [rangeStart, rangeEnd]);

  const colW = 100 / Math.max(months.length, 1);

  return (
    <div className="gc-gantt">
      {/* Header row */}
      <div className="gc-gantt-header">
        <div className="gc-gantt-label-col">Task</div>
        <div className="gc-gantt-bar-area relative flex">
          {months.map((m) => (
            <div key={m} className="gc-gantt-month-label" style={{ width: `${colW}%` }}>{m}</div>
          ))}
        </div>
      </div>

      {/* Grid + task rows */}
      <div className="gc-gantt-body">
        {tasks.map((task) => {
          const start = dateToNum(task.exp_start_date);
          const end   = dateToNum(task.exp_end_date);

          const leftPct  = start > 0 ? Math.max(0, ((start - rangeStart) / rangeMs) * 100) : 0;
          const widthPct = (start > 0 && end > 0)
            ? Math.max(1, ((end - start) / rangeMs) * 100)
            : 0;

          const color = task.color ?? TASK_STATUS_COLOR[task.status ?? "Open"] ?? "#6366f1";
          const prog  = task.progress ?? 0;

          return (
            <div key={task.name} className="gc-gantt-row">
              <div className="gc-gantt-label-col">
                <div className="flex items-center gap-1.5">
                  {task.is_milestone ? (
                    <span className="w-2 h-2 rotate-45 shrink-0" style={{ background: color, display: "inline-block" }} />
                  ) : (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  )}
                  <span className="text-xs truncate" title={task.subject}>{task.subject}</span>
                </div>
                <div className="text-[10px] text-muted mt-0.5 pl-3.5">{prog}%</div>
              </div>
              <div className="gc-gantt-bar-area relative">
                {/* Month gridlines */}
                {months.map((m, i) => (
                  <div
                    key={m}
                    className="absolute inset-y-0 border-l border-border/40"
                    style={{ left: `${i * colW}%` }}
                  />
                ))}
                {/* Task bar */}
                {widthPct > 0 && (
                  <div
                    className="gc-gantt-bar"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: `${color}33`,
                      borderColor: color,
                    }}
                  >
                    <div
                      className="gc-gantt-bar-progress"
                      style={{ width: `${prog}%`, background: color }}
                    />
                    <span className="gc-gantt-bar-label">{task.subject}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="gc-gantt-row">
            <div className="gc-gantt-label-col text-muted text-xs">No tasks</div>
            <div className="gc-gantt-bar-area" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────
function ProjectCard({
  project,
  tasks,
  onSelect,
  onEdit,
}: {
  project: ProjectRow;
  tasks: TaskRow[];
  onSelect: () => void;
  onEdit: () => void;
}) {
  const color   = PROJECT_STATUS_COLOR[project.status ?? ""] ?? "#6366f1";
  const done    = tasks.filter((t) => t.status === "Completed").length;
  const prog    = project.percent_complete ?? 0;
  const overdue = project.expected_end_date && new Date(project.expected_end_date) < new Date() && project.status !== "Completed";

  return (
    <div
      className="gc-project-card group"
      style={{ borderLeftColor: color }}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold text-text group-hover:text-primary transition-colors line-clamp-1">
            {project.project_name}
          </h4>
          {project.customer && (
            <p className="text-xs text-muted mt-0.5 line-clamp-1">{project.customer}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {overdue && (
            <span className="gc-badge-red text-xs">Overdue</span>
          )}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shrink-0"
            style={{ background: `${color}22`, color }}
          >
            {project.status}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="gc-progress mb-2">
        <div className="gc-progress-fill" style={{ width: `${prog}%`, background: color }} />
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>{prog}% complete</span>
        <span>{done}/{tasks.length} tasks</span>
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-muted">
        <span>{project.expected_start_date ?? "—"} → {project.expected_end_date ?? "—"}</span>
        {project.priority && (
          <span style={{ color: PRIORITY_COLOR[project.priority] ?? "#94a3b8" }}>
            ● {project.priority}
          </span>
        )}
      </div>

      <button
        className="gc-icon-btn mt-2 w-full text-xs"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
      >
        Edit Project
      </button>
    </div>
  );
}

// ── Project Form ──────────────────────────────────────────────────────────
function ProjectForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<ProjectRow>;
  onSave: (data: Partial<ProjectRow>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<ProjectRow>>(initial);
  const set = (k: keyof ProjectRow, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <FormGrid cols={2}>
        <FormField label="Project Name" required>
          <input className="gc-input" value={form.project_name ?? ""} onChange={(e) => set("project_name", e.target.value)} required />
        </FormField>
        <FormField label="Status">
          <select className="gc-select" value={form.status ?? "Open"} onChange={(e) => set("status", e.target.value)}>
            {["Open","Completed","Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select className="gc-select" value={form.priority ?? "Medium"} onChange={(e) => set("priority", e.target.value)}>
            {["Low","Medium","High","Urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </FormField>
        <FormField label="Company">
          <input className="gc-input" value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} />
        </FormField>
        <FormField label="Department">
          <input className="gc-input" value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} />
        </FormField>
        <FormField label="Customer">
          <input className="gc-input" value={form.customer ?? ""} onChange={(e) => set("customer", e.target.value)} />
        </FormField>
        <FormField label="Expected Start">
          <input type="date" className="gc-input" value={form.expected_start_date ?? ""} onChange={(e) => set("expected_start_date", e.target.value)} />
        </FormField>
        <FormField label="Expected End">
          <input type="date" className="gc-input" value={form.expected_end_date ?? ""} onChange={(e) => set("expected_end_date", e.target.value)} />
        </FormField>
        <FormField label="Estimated Cost ($)">
          <input type="number" className="gc-input" value={form.estimated_costing ?? ""} onChange={(e) => set("estimated_costing", Number(e.target.value))} />
        </FormField>
        <FormField label="% Complete">
          <input type="number" className="gc-input" min={0} max={100} value={form.percent_complete ?? 0} onChange={(e) => set("percent_complete", Number(e.target.value))} />
        </FormField>
      </FormGrid>
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button type="button" className="gc-btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="gc-btn-primary" disabled={saving}>
          {saving ? "Saving…" : form.name ? "Update" : "Create Project"}
        </button>
      </div>
    </form>
  );
}

// ── Task Form ─────────────────────────────────────────────────────────────
function TaskForm({
  initial,
  projectName,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<TaskRow>;
  projectName: string;
  onSave: (data: Partial<TaskRow>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<TaskRow>>({ project: projectName, ...initial });
  const set = (k: keyof TaskRow, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <FormGrid cols={2}>
        <FormField label="Task Name" required>
          <input className="gc-input" value={form.subject ?? ""} onChange={(e) => set("subject", e.target.value)} required />
        </FormField>
        <FormField label="Status">
          <select className="gc-select" value={form.status ?? "Open"} onChange={(e) => set("status", e.target.value)}>
            {["Open","Working","Pending Review","Completed","Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select className="gc-select" value={form.priority ?? "Medium"} onChange={(e) => set("priority", e.target.value)}>
            {["Low","Medium","High","Urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </FormField>
        <FormField label="% Progress">
          <input type="number" className="gc-input" min={0} max={100} value={form.progress ?? 0} onChange={(e) => set("progress", Number(e.target.value))} />
        </FormField>
        <FormField label="Expected Start">
          <input type="date" className="gc-input" value={form.exp_start_date ?? ""} onChange={(e) => set("exp_start_date", e.target.value)} />
        </FormField>
        <FormField label="Expected End">
          <input type="date" className="gc-input" value={form.exp_end_date ?? ""} onChange={(e) => set("exp_end_date", e.target.value)} />
        </FormField>
        <FormField label="Expected Hours">
          <input type="number" className="gc-input" value={form.expected_time ?? ""} onChange={(e) => set("expected_time", Number(e.target.value))} />
        </FormField>
        <FormField label="Milestone?">
          <div className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              id="is_milestone"
              checked={!!form.is_milestone}
              onChange={(e) => set("is_milestone", e.target.checked ? 1 : 0)}
              className="w-4 h-4"
            />
            <label htmlFor="is_milestone" className="text-xs text-muted">Mark as milestone</label>
          </div>
        </FormField>
      </FormGrid>
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button type="button" className="gc-btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="gc-btn-primary" disabled={saving}>
          {saving ? "Saving…" : form.name ? "Update Task" : "Add Task"}
        </button>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const [statusFilter, setStatusFilter] = useState("Open");
  const [search, setSearch]             = useState("");
  const [view, setView]                 = useState<"cards" | "table">("cards");
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editProject, setEditProject]         = useState<ProjectRow | null>(null);
  const [showTaskForm, setShowTaskForm]        = useState(false);
  const [editTask, setEditTask]               = useState<TaskRow | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data: projects = [], isLoading: pjLoading, refetch: refetchProjects } = useQuery({
    queryKey: ["projects", statusFilter, search],
    queryFn: () => fetchProjects({ status: statusFilter || undefined, search: search || undefined }),
  });

  const { data: allTasks = [], isLoading: tLoading } = useQuery({
    queryKey: ["tasks", selectedProject?.name],
    queryFn: () => selectedProject ? fetchTasks({ project: selectedProject.name }) : Promise.resolve([]),
    enabled: !!selectedProject,
  });

  // For the overview, get tasks for all projects (limited count)
  const { data: overviewTasks = [] } = useQuery({
    queryKey: ["tasks_overview"],
    queryFn: () => fetchTasks({}),
  });

  // KPIs
  const totalProjects  = projects.length;
  const openProjects   = projects.filter((p) => p.status === "Open").length;
  const doneProjects   = projects.filter((p) => p.status === "Completed").length;
  const overdueProjs   = projects.filter((p) =>
    p.expected_end_date && new Date(p.expected_end_date) < new Date() && p.status !== "Completed"
  ).length;

  // Gantt range
  const [ganttRangeStart, ganttRangeEnd] = useMemo(() => {
    const dates = (selectedProject ? allTasks : overviewTasks)
      .flatMap((t) => [dateToNum(t.exp_start_date), dateToNum(t.exp_end_date)])
      .filter((d) => d > 0);
    if (!dates.length) {
      const now = Date.now();
      return [now - 30 * 86400000, now + 90 * 86400000];
    }
    const min = Math.min(...dates) - 7 * 86400000;
    const max = Math.max(...dates) + 7 * 86400000;
    return [min, max];
  }, [allTasks, overviewTasks, selectedProject]);

  // Tasks grouped by status
  const tasksByStatus = useMemo(() => {
    const m: Record<string, TaskRow[]> = {};
    allTasks.forEach((t) => {
      const s = t.status ?? "Open";
      (m[s] ??= []).push(t);
    });
    return m;
  }, [allTasks]);

  // Mutations
  const createProjMut = useMutation({
    mutationFn: createProject,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setShowProjectForm(false); },
  });
  const updateProjMut = useMutation({
    mutationFn: ({ name, data }: { name: string; data: Partial<ProjectRow> }) => updateProject(name, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setEditProject(null); },
  });
  const createTaskMut = useMutation({
    mutationFn: createTask,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setShowTaskForm(false); },
  });
  const updateTaskMut = useMutation({
    mutationFn: ({ name, data }: { name: string; data: Partial<TaskRow> }) => updateTask(name, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setEditTask(null); },
  });
  const deleteTaskMut = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setDeleteTaskTarget(null); },
  });

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Filter bar */}
      <FilterRow onRefresh={refetchProjects}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Search</span>
          <input className="gc-input w-48" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Project name…" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Status</span>
          <select className="gc-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {["Open","Completed","Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">View</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["cards","table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${view === v ? "bg-primary text-white" : "bg-card text-muted hover:bg-surface"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </label>
        <button className="gc-btn-primary self-end" onClick={() => setShowProjectForm(true)}>
          + New Project
        </button>
      </FilterRow>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={totalProjects} color="#6366f1" />
        <StatCard label="Open"           value={openProjects}  color="#0ea5e9" />
        <StatCard label="Completed"      value={doneProjects}  color="#10b981" />
        <StatCard label="Overdue"        value={overdueProjs}  color="#ef4444" />
      </div>

      {/* Project cards / table */}
      {pjLoading ? <LoadingBlock /> : projects.length === 0 ? <EmptyBlock /> : (
        view === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.name}
                project={p}
                tasks={overviewTasks.filter((t) => t.project === p.name)}
                onSelect={() => setSelectedProject(p)}
                onEdit={() => setEditProject(p)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader title="All Projects" />
            <div className="px-4 pb-4">
              <DataTable
                keyField="name"
                rows={projects}
                cols={[
                  {
                    key: "project_name",
                    label: "Name",
                    render: (r) => (
                      <button className="font-semibold text-primary hover:underline text-left" onClick={() => setSelectedProject(r)}>
                        {r.project_name}
                      </button>
                    ),
                  },
                  { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
                  {
                    key: "priority",
                    label: "Priority",
                    render: (r) => r.priority ? (
                      <span className="text-xs font-semibold" style={{ color: PRIORITY_COLOR[r.priority] ?? "#94a3b8" }}>
                        {r.priority}
                      </span>
                    ) : <span className="text-muted">—</span>,
                  },
                  {
                    key: "percent_complete",
                    label: "Progress",
                    render: (r) => (
                      <div className="flex items-center gap-2">
                        <div className="gc-progress w-20">
                          <div className="gc-progress-fill" style={{ width: `${r.percent_complete ?? 0}%`, background: PROJECT_STATUS_COLOR[r.status ?? ""] ?? "#6366f1" }} />
                        </div>
                        <span className="text-xs">{r.percent_complete ?? 0}%</span>
                      </div>
                    ),
                  },
                  { key: "expected_start_date", label: "Start" },
                  { key: "expected_end_date",   label: "End" },
                  { key: "customer",             label: "Customer" },
                  {
                    key: "actions",
                    label: "",
                    render: (r) => (
                      <button className="gc-icon-btn" onClick={() => setEditProject(r)} title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    ),
                  },
                ]}
              />
            </div>
          </Card>
        )
      )}

      {/* Project Detail Panel */}
      {selectedProject && (
        <Card>
          <CardHeader
            title={selectedProject.project_name}
            subtitle={`${selectedProject.status} · ${selectedProject.percent_complete ?? 0}% complete`}
            action={
              <div className="flex gap-2">
                <button className="gc-btn-outline text-xs" onClick={() => setShowTaskForm(true)}>+ Add Task</button>
                <button className="gc-btn-ghost text-xs" onClick={() => setSelectedProject(null)}>✕ Close</button>
              </div>
            }
          />

          {/* Tasks split: list + gantt */}
          <div className="px-5 pb-5 space-y-4">
            {tLoading ? <LoadingBlock /> : allTasks.length === 0 ? (
              <EmptyBlock msg="No tasks yet. Click '+ Add Task' to create one." />
            ) : (
              <>
                {/* Task list */}
                <DataTable
                  keyField="name"
                  rows={allTasks}
                  cols={[
                    {
                      key: "subject",
                      label: "Task",
                      render: (t) => (
                        <div className="flex items-center gap-2">
                          {t.is_milestone ? (
                            <span style={{ color: TASK_STATUS_COLOR[t.status ?? ""] ?? "#6366f1" }} className="text-base">◆</span>
                          ) : (
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TASK_STATUS_COLOR[t.status ?? ""] ?? "#6366f1" }} />
                          )}
                          <span className="font-medium text-sm">{t.subject}</span>
                        </div>
                      ),
                    },
                    { key: "status",   label: "Status",   render: (t) => <StatusPill status={t.status} /> },
                    {
                      key: "priority",
                      label: "Priority",
                      render: (t) => t.priority
                        ? <span className="text-xs font-semibold" style={{ color: PRIORITY_COLOR[t.priority] ?? "#94a3b8" }}>{t.priority}</span>
                        : <span className="text-muted">—</span>,
                    },
                    {
                      key: "progress",
                      label: "Progress",
                      render: (t) => (
                        <div className="flex items-center gap-2">
                          <div className="gc-progress w-16">
                            <div className="gc-progress-fill" style={{ width: `${t.progress ?? 0}%`, background: TASK_STATUS_COLOR[t.status ?? ""] ?? "#6366f1" }} />
                          </div>
                          <span className="text-xs">{t.progress ?? 0}%</span>
                        </div>
                      ),
                    },
                    { key: "exp_start_date", label: "Start" },
                    { key: "exp_end_date",   label: "End" },
                    {
                      key: "actions",
                      label: "",
                      align: "right",
                      render: (t) => (
                        <div className="flex items-center gap-1">
                          <button className="gc-icon-btn" onClick={() => setEditTask(t)}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button className="gc-icon-btn danger" onClick={() => setDeleteTaskTarget(t.name)}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ),
                    },
                  ]}
                />

                {/* Gantt */}
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Timeline</p>
                  <div className="gc-card overflow-auto">
                    <GanttTimeline
                      tasks={allTasks}
                      rangeStart={ganttRangeStart}
                      rangeEnd={ganttRangeEnd}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Modals */}
      <Modal open={showProjectForm} onClose={() => setShowProjectForm(false)} title="New Project" size="lg">
        <ProjectForm
          initial={{ expected_start_date: new Date().toISOString().slice(0,10), status: "Open", priority: "Medium" }}
          onSave={(data) => createProjMut.mutate(data)}
          onCancel={() => setShowProjectForm(false)}
          saving={createProjMut.isPending}
        />
        {createProjMut.isError && <p className="text-red-600 text-xs mt-2">{String((createProjMut.error as Error).message)}</p>}
      </Modal>

      <Modal open={!!editProject} onClose={() => setEditProject(null)} title={`Edit: ${editProject?.project_name ?? ""}`} size="lg">
        {editProject && (
          <ProjectForm
            initial={editProject}
            onSave={(data) => updateProjMut.mutate({ name: editProject.name, data })}
            onCancel={() => setEditProject(null)}
            saving={updateProjMut.isPending}
          />
        )}
      </Modal>

      <Modal open={showTaskForm} onClose={() => setShowTaskForm(false)} title="New Task" size="md">
        {selectedProject && (
          <TaskForm
            initial={{}}
            projectName={selectedProject.name}
            onSave={(data) => createTaskMut.mutate(data)}
            onCancel={() => setShowTaskForm(false)}
            saving={createTaskMut.isPending}
          />
        )}
        {createTaskMut.isError && <p className="text-red-600 text-xs mt-2">{String((createTaskMut.error as Error).message)}</p>}
      </Modal>

      <Modal open={!!editTask} onClose={() => setEditTask(null)} title={`Edit: ${editTask?.subject ?? ""}`} size="md">
        {editTask && selectedProject && (
          <TaskForm
            initial={editTask}
            projectName={selectedProject.name}
            onSave={(data) => updateTaskMut.mutate({ name: editTask.name, data })}
            onCancel={() => setEditTask(null)}
            saving={updateTaskMut.isPending}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTaskTarget}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        danger
        onConfirm={() => deleteTaskTarget && deleteTaskMut.mutate(deleteTaskTarget)}
        onCancel={() => setDeleteTaskTarget(null)}
      />
    </div>
  );
}
