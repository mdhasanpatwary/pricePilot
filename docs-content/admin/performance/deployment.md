---
title: "Deployment"
description: "Deployment procedures and best practices"
category: "performance"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["deployment", "operations", "procedures"]
audience: "admin"
---

# Deployment Guide

PricePilot uses a split-service architecture for scalability. The application runs two distinct Node.js processes: a web server and a background worker.

## 1. Prerequisites

- **Node.js** v18+
- **PostgreSQL** or **MySQL** (Primary Database)
- **Redis** v6+ (Required for Job Queues)

## 2. Infrastructure Overview

The application consists of **two** processes that run together:

1.  **Web Server**: Handles HTTP requests, API endpoints, and the UI.
2.  **Worker Process**: Processes background jobs like syncs, scraping, and notifications.

> **Why?** The scraping process (Playwright) acts like a heavy browser. If we ran this inside the Web Server, a heavy sync could block the UI or crash the entire website due to memory limits. Separating them ensures the dashboard remains fast even while syncing thousands of products.

## 3. Quick Start

### Development
```bash
npm run dev
```
This automatically starts both the Next.js dev server and the worker process.

### Production
```bash
npm run build
npm start
```
This builds the app and starts both the web server and worker together.

## 4. Deployment Strategies

### Option A: Simple Deployment (VPS/Bare Metal)

The built-in `npm start` command runs both processes using `concurrently`. For production reliability, use PM2:

```bash
npm install -g pm2
npm run build
pm2 start npm --name "pricepilot" -- start
pm2 save
```

### Option B: Advanced Deployment with PM2 (Fine-grained Control)

If you need separate monitoring/scaling for each process:

1.  **Create `ecosystem.config.js`:**
    ```javascript
    module.exports = {
      apps: [
        {
          name: "pricepilot-web",
          script: "npm",
          args: "start",
          env: {
            PORT: 3000,
            NODE_ENV: "production"
          }
        },
        {
          name: "pricepilot-worker",
          script: "npm",
          args: "run worker",
          env: {
            NODE_ENV: "production"
          }
        }
      ]
    }
    ```

2.  **Start:**
    ```bash
    pm2 start ecosystem.config.js
    pm2 save
    ```

### Option C: Docker

```yaml
version: '3.8'

services:
  app:
    build: .
    command: npm start  # Runs both web + worker
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:alpine
```

## 5. Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Redis (Critical for Queues)
REDIS_URL="redis://localhost:6379"

# Security
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="https://app.yourdomain.com"
```
