-- Add uptime tracking tables

-- System uptime log table
-- Records every heartbeat check (every minute)
CREATE TABLE IF NOT EXISTS "SystemUptimeLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL, -- 'UP', 'DOWN', 'DEGRADED'
    "responseTime" INTEGER NOT NULL, -- in milliseconds
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Downtime incident table
-- Records periods when system was down
CREATE TABLE IF NOT EXISTS "DowntimeIncident" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER, -- in minutes
    "reason" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "SystemUptimeLog_timestamp_idx" ON "SystemUptimeLog" ("timestamp" DESC);

CREATE INDEX IF NOT EXISTS "SystemUptimeLog_status_idx" ON "SystemUptimeLog" ("status");

CREATE INDEX IF NOT EXISTS "DowntimeIncident_startTime_idx" ON "DowntimeIncident" ("startTime" DESC);

CREATE INDEX IF NOT EXISTS "DowntimeIncident_resolved_idx" ON "DowntimeIncident" ("resolved");