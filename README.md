# Symmetry Admin Dashboard

Internal observability dashboard for monitoring Symmetry's Azure infrastructure and databases.

**Production URL**: https://sym-admin-dashboard.vercel.app

## Features

- **Infrastructure Metrics** - Request volume, error rates, service health from App Insights
- **Database Metrics** - PostgreSQL stats, user counts, job status, table sizes
- **LLM Analytics** - Token usage, costs per model, call trends
- **Error Tracking** - Recent errors, error trends, top failing endpoints
- **AI Assistant** - Natural language queries to explore your data
- **Environment Toggle** - Switch between PROD and TEST environments

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp env.template .env.local

# Start development server
npm run dev
```

Open http://localhost:3000

## Environment Variables

All configuration is via environment variables. See `env.template` for the full list.

**Required:**
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` - Service Principal
- `AZURE_SUBSCRIPTION_ID` - Azure subscription
- `PROD_DATABASE_URL`, `TEST_DATABASE_URL` - PostgreSQL connection strings
- `PROD_APP_INSIGHTS_WORKSPACE_ID`, `TEST_APP_INSIGHTS_WORKSPACE_ID` - Log Analytics workspace IDs
- `PROD_RESOURCE_GROUP`, `TEST_RESOURCE_GROUP` - Resource group names
- `PROD_APP_INSIGHTS`, `TEST_APP_INSIGHTS` - App Insights resource names
- `PROD_SERVICE_BUS`, `TEST_SERVICE_BUS` - Service Bus namespace names

**For AI Chat:**
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_RESOURCE`, `AZURE_OPENAI_RG`

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Overview | `/` | Infrastructure metrics, service health, queues |
| Database | `/database` | PostgreSQL stats, table sizes, slow queries |
| LLM | `/llm` | Token usage, costs, model breakdown |
| Errors | `/errors` | Error trends, recent errors, top endpoints |
| Deployments | `/deployments` | Deployment history (coming soon) |
| AI Assistant | `/ai` | Natural language data exploration |

## API Routes

| Endpoint | Description |
|----------|-------------|
| `GET /api/metrics?env=prod&range=24h` | Infrastructure metrics |
| `GET /api/database?env=prod&range=24h` | Database metrics |
| `GET /api/llm?env=prod&range=24h` | LLM usage metrics |
| `GET /api/errors?env=prod&range=24h` | Error analytics |
| `POST /api/ai/chat` | AI assistant queries |

## Tech Stack

- **Next.js 16** - React framework with App Router
- **Tailwind CSS** - Styling
- **Recharts** - Charts and visualizations
- **SWR** - Data fetching with caching
- **Azure SDKs** - `@azure/monitor-query`, `@azure/identity`, `@azure/service-bus`
- **pg** - PostgreSQL client

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes (metrics, database, llm, errors, ai)
│   ├── page.tsx       # Overview page
│   ├── database/      # Database metrics page
│   ├── llm/           # LLM analytics page
│   ├── errors/        # Error tracking page
│   └── ai/            # AI assistant page
├── components/
│   ├── ai/            # AI chat components
│   ├── charts/        # Recharts wrappers
│   ├── dashboard/     # Dashboard widgets
│   ├── layout/        # Sidebar, Header
│   └── ui/            # Reusable UI components
├── hooks/
│   ├── useMetrics.ts  # Metrics data hook
│   └── useDashboardData.ts  # Unified data hook
├── lib/
│   └── api/           # Shared API utilities
│       ├── config.ts  # Environment configuration
│       ├── azure.ts   # Azure SDK operations
│       ├── database.ts # PostgreSQL operations
│       ├── cache.ts   # LRU caching
│       └── queries/   # Query definitions
└── types/
    └── metrics.ts     # TypeScript interfaces
```

## Deployment

Deployed on Vercel with CI/CD from GitHub:
- Push to `main` → Production deployment
- Pull requests → Preview deployments

---

Built for Symmetry internal use 🔒
