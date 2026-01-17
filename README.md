# Symmetry Admin Dashboard

🚀 **Internal observability dashboard** for monitoring Symmetry's Azure production environment.

![Dashboard Preview](/.ai-tasks/2026-01-17-internal-dashboard/dashboard-collapsed.png)

## Features

✅ **Real-time Azure Metrics**
- Request volume & error rates from App Insights
- LLM usage (tokens, costs) per model
- Service Bus queue depth & dead letters
- Service health status

✅ **Beautiful Dark UI**
- Modern glassmorphism design
- Responsive grid layout
- Real-time data refresh

✅ **Environment Switching**
- Toggle between PROD and TEST environments
- Clear visual indicators

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev -- -p 3001

# Open http://localhost:3001
```

## Prerequisites

- Azure CLI logged in with access to:
  - `ai-asp-sym-prod-centralus` (App Insights)
  - `sb-sym-prod-centralus` (Service Bus)
  - `rg-sym-prod-centralus` (Resource Group)

## API Routes

| Endpoint | Description |
|----------|-------------|
| `GET /api/metrics?env=prod` | Fetches all dashboard metrics |

## Tech Stack

- **Next.js 16** - React framework
- **Tailwind CSS** - Styling
- **Recharts** - Charts
- **SWR** - Data fetching
- **Lucide Icons** - Icons

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── metrics/    # Azure data endpoints
│   ├── page.tsx        # Main dashboard
│   └── layout.tsx      # Root layout
├── components/
│   ├── charts/         # Recharts wrappers
│   ├── dashboard/      # Dashboard widgets
│   ├── layout/         # Sidebar, Header
│   └── ui/             # Reusable UI components
├── hooks/
│   └── useMetrics.ts   # Data fetching hook
└── lib/
    └── utils.ts        # Utility functions
```

## Roadmap

- [ ] Database metrics (PostgreSQL user counts, KU counts)
- [ ] Deployment tracking (versions, timestamps)
- [ ] Historical data charts
- [ ] Alert thresholds
- [ ] AI-powered prompt generation (json-render)

---

Built for Symmetry internal use 🔒
