"use client";

import { useState, useEffect } from "react";
import {
  CalendarClock,
  Play,
  PauseCircle,
  RotateCw,
  Clock,
  CheckCircle2,
  Loader2,
  Power,
} from "lucide-react";

interface ScheduledTask {
  id: string;
  name: string;
  schedule: string;
  lastRun: string;
  status: "idle" | "running";
  enabled: boolean;
  description: string;
}

export default function SchedulerPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/v1/admin/scheduler");
      if (res.ok) {
        setTasks(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch tasks", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // Poll for status updates every 5 seconds
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRun = async (taskId: string) => {
    setProcessingId(taskId);
    try {
      await fetch("/api/v1/admin/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", taskId }),
      });
      await fetchTasks();
    } catch (error) {
      console.error("Failed to run task", error);
    } finally {
      setTimeout(() => setProcessingId(null), 500);
    }
  };

  const handleToggle = async (taskId: string) => {
    // Optimistic update
    setTasks(
      tasks.map((t) => (t.id === taskId ? { ...t, enabled: !t.enabled } : t)),
    );

    try {
      await fetch("/api/v1/admin/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", taskId }),
      });
    } catch (error) {
      // Revert on failure
      fetchTasks();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Task Scheduler</h1>
        <p className="text-muted-foreground">
          Manage automated background jobs, maintenance tasks, and manual
          triggers.
        </p>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
              <tr>
                <th className="px-6 py-4">Task Name</th>
                <th className="px-6 py-4">Schedule</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Run</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className="group hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-md ${task.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        <CalendarClock className="w-5 h-5" />
                      </div>
                      <div>
                        <p
                          className={`font-medium ${!task.enabled && "text-muted-foreground"}`}
                        >
                          {task.name}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {task.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>{task.schedule}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {task.status === "running" ? (
                      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1 rounded-full w-fit">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-xs font-medium">Running</span>
                      </div>
                    ) : !task.enabled ? (
                      <div className="flex items-center gap-2 text-muted-foreground bg-muted px-2.5 py-1 rounded-full w-fit">
                        <PauseCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Paused</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 rounded-full w-fit">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Idle</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(task.lastRun).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggle(task.id)}
                        className={`p-2 rounded-md transition-colors ${
                          task.enabled
                            ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        title={task.enabled ? "Pause Task" : "Enable Task"}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRun(task.id)}
                        disabled={
                          task.status === "running" || processingId === task.id
                        }
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {processingId === task.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        Run Now
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
