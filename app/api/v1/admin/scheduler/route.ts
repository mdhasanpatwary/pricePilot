import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";

// Mock storage for task status (In a real app, this would be in the DB)
let tasks = [
  {
    id: "sync-all",
    name: "Global Price Sync",
    schedule: "Every 24 hours",
    lastRun: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    status: "idle", // idle, running
    enabled: true,
    description: "Triggers price synchronization for all active tenants.",
  },
  {
    id: "cleanup-logs",
    name: "System Log Cleanup",
    schedule: "Every 24 hours",
    lastRun: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
    status: "idle",
    enabled: true,
    description: "Removes sync logs older than 30 days to save space.",
  },
  {
    id: "health-check",
    name: "Automated Diagnostics",
    schedule: "Every 5 minutes",
    lastRun: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    status: "idle",
    enabled: true,
    description: "Runs system health checks and alerts on failure.",
  },
];

export async function GET() {
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, taskId } = body;

    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (action === "toggle") {
      tasks[taskIndex].enabled = !tasks[taskIndex].enabled;
      return NextResponse.json({ success: true, task: tasks[taskIndex] });
    }

    if (action === "run") {
      // Prevent running if already running
      if (tasks[taskIndex].status === "running") {
        return NextResponse.json(
          { error: "Task is already running" },
          { status: 400 },
        );
      }

      tasks[taskIndex].status = "running";

      // Execute task logic asynchronously
      runTaskLogic(tasks[taskIndex].id).finally(() => {
        tasks[taskIndex].status = "idle";
        tasks[taskIndex].lastRun = new Date().toISOString();
      });

      return NextResponse.json({
        success: true,
        message: "Task started",
        task: tasks[taskIndex],
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

async function runTaskLogic(taskId: string) {
  console.log(`[Scheduler] Starting task: ${taskId}`);
  try {
    switch (taskId) {
      case "sync-all":
        // Get all tenants
        const tenants = await prisma.tenant.findMany({ select: { id: true } });
        for (const tenant of tenants) {
          try {
            await SyncOrchestrator.dispatchFullSync(tenant.id);
          } catch (e) {
            console.error(`Failed to sync tenant ${tenant.id}`, e);
          }
        }
        break;

      case "cleanup-logs":
        // Delete logs older than 30 days
        const date = new Date();
        date.setDate(date.getDate() - 30);
        await prisma.syncLog.deleteMany({
          where: {
            createdAt: {
              lt: date,
            },
          },
        });
        break;

      case "health-check":
        // Simple ping to diagnostics endpoint logic (simulated delay)
        await new Promise((resolve) => setTimeout(resolve, 2000));
        break;
    }
  } catch (error) {
    console.error(`[Scheduler] Task ${taskId} failed:`, error);
  } finally {
    console.log(`[Scheduler] Finished task: ${taskId}`);
  }
}
