# eatmyface.co — Amazon Ads Optimization Agent

## Project Overview
Daily automated Amazon Ads performance analysis agent that runs at 7 AM PT. Analyzes Sponsored Products and Sponsored Brands campaigns across 15 portfolios, generates optimization recommendations, and emails a report to jeff@eatmyface.co for approval.

## Tech Stack
- TypeScript / Node.js (ESM)
- Amazon Advertising API v3
- Gmail (for sending reports via MCP)
- Claude Code scheduled triggers (cron)

## KPI Targets
- **ROAS**: 4x minimum
- **ACoS**: Below 35%
- **Min Daily Sales**: $1,000
- **Rolling Windows**: Yesterday, 7-day, 14-day, 30-day

## Architecture
```
src/
├── types.ts               # All TypeScript interfaces and constants
├── amazon-ads-client.ts   # Amazon Ads API client (auth, reports, mutations)
├── data-collector.ts      # Fetches data across all rolling windows
├── analyzer.ts            # KPI scoring, trend analysis, proposed changes
├── report-builder.ts      # HTML email report generation
├── index.ts               # Main entry point — orchestrates the full pipeline
├── get-refresh-token.ts   # Helper to obtain refresh token via OAuth
└── test-api-connection.ts # Verifies API credentials and connectivity
```

## Key Decisions
- **Human-in-the-loop**: Agent proposes changes, Jeff approves via email reply. No automatic changes.
- **Rolling window analysis**: Never react to a single day's data alone. Compare yesterday vs 7/14/30-day trends before recommending changes.
- **Portfolio-first hierarchy**: Analysis starts at portfolio level, drills into campaigns, ad groups, and keywords.
- **New-to-Brand tracking**: Sponsored Brands NTB metrics used to inform customer acquisition strategy.

## Environment Variables (stored as secrets)
- `AMAZON_ADS_CLIENT_ID` — Amazon LWA app client ID
- `AMAZON_ADS_CLIENT_SECRET` — Amazon LWA app client secret
- `AMAZON_ADS_REFRESH_TOKEN` — OAuth refresh token (obtained via get-refresh-token.ts)
- `AMAZON_ADS_REGION` — API region (default: NA)

## Running Locally
```bash
npm install
npm run test-api    # Verify API connection
npm run analyze     # Run full analysis
npm run get-token   # Helper to get refresh token
```

## Scheduled Agent
The daily agent is configured as a Claude Code trigger running at `0 14 * * *` (7 AM PT / 2 PM UTC).
See `agent-prompt.md` for the full agent instructions.
