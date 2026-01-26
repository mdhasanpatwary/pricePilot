# 🛫 PricePilot

**Engineering the Future of E-commerce Yield Management.**

PricePilot is a professional-grade SaaS platform designed for high-velocity merchants. It provides real-time market intelligence, automated competitor monitoring, and tactical price execution to maximize margins and dominate market share.

---

## 🚀 Key Strategic Pillars

*   **⚡ Real-Time Intelligence**: Automated crawlers with advanced stealth capabilities hunt for competitor price movements.
*   **🎯 Tactical Execution**: Apply aggressive undercutting or margin-safe index scaling via the Execution Engine.
*   **📊 Market Command**: A high-fidelity dashboard provides a "Position Summary" of your standing (Cheapest, Neutral, Expensive).
*   **🔒 Enterprise Security**: Multi-tenant architecture with robust JWT-based route protection and encrypted API sync.
*   **🕵️ Advanced Stealth**: Intelligent proxy management, challenge detection, and human behavior simulation to bypass anti-bot systems.

---

## 🛠 Technical Architecture

PricePilot is built on a modern, distributed stack designed for performance and vertical scaling.

### Core Stack
| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/) |
| **Auth** | [NextAuth.js](https://next-auth.js.org/) (JWT Strategy) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) & [Vanilla CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) |
| **Charts** | [Recharts](https://recharts.org/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Alerts** | [Sonner](https://sonner.stevenly.me/) |

### System Flow
```mermaid
graph TD
    A[Client Browser] -->|NextAuth Session| B[Next.js App Router]
    B -->|API Requests| C[Next.js API Routes]
    C -->|Prisma Client| D[(PostgreSQL)]
    E[Crawler Engine] -->|Public Web Data| F[Market Intelligence Layer]
    F -->|Normalized Data| D
    B -->|Real-time UI| G[Sonner/Recharts]
```

---

## ⚙️ Development Setup

### 1. Prerequisites
- Node.js 18.x or higher
- PostgreSQL instance (or Prisma Dev Proxy)

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL="your_postgresql_connection_string"

# Authentication
NEXTAUTH_SECRET="your_secure_random_hash"
NEXTAUTH_URL="http://localhost:3000"

# Advanced Scraping (Optional)
SCRAPER_PROXIES="http://proxy1:8080,http://proxy2:8080"
PROXY_USERNAME="your_proxy_username"
PROXY_PASSWORD="your_proxy_password"
STEALTH_LEVEL="advanced"
BLOCK_RATE_THRESHOLD="0.3"
```

See [docs/STEALTH_SCRAPING.md](docs/STEALTH_SCRAPING.md) for complete configuration options.

### 3. Installation & Database Sync
```bash
# Install dependencies
npm install

# Generate Prisma client and run migrations
npx prisma generate
npx prisma db push

# Start the command center
npm run dev
```

---

## 📚 Documentation

### User Guides
- **[Main Documentation](DOCUMENTATION.md)**: Complete user guide for merchants and administrators
- **[Admin Dashboard Guide](docs/ADMIN_GUIDE.md)**: Step-by-step guide for admin monitoring dashboards
- **[Tenant Dashboard Guide](docs/TENANT_GUIDE.md)**: Guide for tenant metrics and configuration

### Technical Documentation
- **[Architecture Guide](docs/ARCHITECTURE.md)**: System architecture and component overview
- **[Stealth Scraping Guide](docs/STEALTH_SCRAPING.md)**: Advanced scraping features and configuration
- **[Monitoring UI Guide](docs/MONITORING_UI.md)**: Comprehensive monitoring dashboard documentation
- **[API Reference](docs/API_MONITORING.md)**: Monitoring API endpoint reference
- **[Site Profile Examples](docs/SITE_PROFILE_EXAMPLES.md)**: Configuration examples for various scenarios
- **[Environment Variables](docs/ENVIRONMENT_VARIABLES.md)**: Complete environment variable reference
- **[Deployment Guide](docs/DEPLOYMENT.md)**: Production deployment instructions
- **[Runbook](docs/RUNBOOK.md)**: Operational procedures and troubleshooting

---

## 🗺 Product Roadmap

- [x] **v1.0 (Current)**: UI/UX Redesign, Auth Integration, API Infrastructure.
- [ ] **v1.1**: Real-time Crawler Deployment (OpenCart/Laravel Integrations).
- [ ] **v1.2**: AI-Powered Dynamic Pricing Rules (ML model for elasticity).
- [ ] **v2.0**: Global Market Expansion & Multi-Currency Support.

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  <b>Built for winners, by senior architects.</b><br>
  © 2026 PricePilot Engineering Team
</p>
