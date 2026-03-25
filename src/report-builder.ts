import type {
  AnalysisReport,
  PortfolioAnalysis,
  ProposedChange,
  PortfolioMetrics,
  NewToBrandInsight,
} from "./types.js";
import { KPI_TARGETS } from "./types.js";

export class ReportBuilder {
  buildHtmlEmail(report: AnalysisReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; color: #333; }
  .container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 30px; }
  .header h1 { margin: 0 0 5px 0; font-size: 24px; }
  .header .date { opacity: 0.8; font-size: 14px; }
  .section { padding: 25px 30px; border-bottom: 1px solid #eee; }
  .section h2 { margin: 0 0 15px 0; font-size: 18px; color: #1a1a2e; }
  .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .metric-box { background: #f8f9fa; border-radius: 6px; padding: 12px; text-align: center; }
  .metric-box .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .metric-box .value { font-size: 20px; font-weight: 700; margin: 4px 0; }
  .metric-box .sublabel { font-size: 10px; color: #999; }
  .good { color: #22c55e; }
  .warn { color: #f59e0b; }
  .bad { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f8f9fa; text-align: left; padding: 8px 12px; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
  .status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
  .status-green { background: #22c55e; }
  .status-yellow { background: #f59e0b; }
  .status-red { background: #ef4444; }
  .change-card { background: #f8f9fa; border-radius: 6px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #3b82f6; }
  .change-card.high { border-left-color: #ef4444; }
  .change-card.medium { border-left-color: #f59e0b; }
  .change-card.low { border-left-color: #22c55e; }
  .change-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .change-id { background: #1a1a2e; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .change-type { font-size: 11px; text-transform: uppercase; font-weight: 600; }
  .change-entity { font-weight: 600; font-size: 14px; }
  .change-rationale { font-size: 13px; color: #555; margin-top: 6px; }
  .change-values { font-size: 12px; color: #888; margin-top: 4px; }
  .ntb-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 4px; }
  .ntb-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 4px; }
  .structure-rec { background: #eff6ff; border-radius: 6px; padding: 12px 15px; margin-bottom: 8px; font-size: 13px; border-left: 4px solid #3b82f6; }
  .footer { padding: 20px 30px; background: #f8f9fa; font-size: 12px; color: #888; text-align: center; }
  .approval-note { background: #fefce8; border: 1px solid #fde68a; border-radius: 6px; padding: 15px; margin-top: 15px; font-size: 13px; }
  .window-tabs { display: flex; gap: 0; margin-bottom: 12px; }
  .window-tab { padding: 6px 14px; font-size: 12px; font-weight: 600; background: #f0f0f0; color: #666; }
  .window-tab:first-child { border-radius: 4px 0 0 4px; }
  .window-tab:last-child { border-radius: 0 4px 4px 0; }
  .window-tab.active { background: #1a1a2e; color: #fff; }
</style>
</head>
<body>
<div class="container">

${this.renderHeader(report)}
${this.renderAccountSummary(report)}
${this.renderPortfolioScorecard(report)}
${this.renderProposedChanges(report)}
${this.renderNewToBrand(report)}
${this.renderStructureRecommendations(report)}
${this.renderFooter()}

</div>
</body>
</html>`;
  }

  private renderHeader(report: AnalysisReport): string {
    const date = new Date(report.generatedAt);
    return `
<div class="header">
  <h1>Amazon Ads Daily Performance Report</h1>
  <div class="date">${date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} &bull; eatmyface.co</div>
</div>`;
  }

  private renderAccountSummary(report: AnalysisReport): string {
    const { yesterday, days7, days14, days30 } = report.accountSummary;

    return `
<div class="section">
  <h2>Account Summary</h2>
  <div class="window-tabs">
    <div class="window-tab">Yesterday</div>
    <div class="window-tab active">7 Day</div>
    <div class="window-tab">14 Day</div>
    <div class="window-tab">30 Day</div>
  </div>
  <table>
    <tr>
      <th>Window</th>
      <th>Sales</th>
      <th>Spend</th>
      <th>ROAS</th>
      <th>ACoS</th>
      <th>Orders</th>
      <th>Clicks</th>
      <th>CTR</th>
    </tr>
    ${this.renderSummaryRow("Yesterday", yesterday)}
    ${this.renderSummaryRow("7 Day", days7)}
    ${this.renderSummaryRow("14 Day", days14)}
    ${this.renderSummaryRow("30 Day", days30)}
  </table>
</div>`;
  }

  private renderSummaryRow(label: string, m: PortfolioMetrics): string {
    const roasClass = m.roas >= KPI_TARGETS.ROAS_TARGET ? "good" : m.roas >= KPI_TARGETS.ROAS_TARGET * 0.75 ? "warn" : "bad";
    const acosClass = m.acos <= KPI_TARGETS.ACOS_TARGET ? "good" : m.acos <= KPI_TARGETS.ACOS_TARGET * 1.2 ? "warn" : "bad";

    return `
    <tr>
      <td><strong>${label}</strong></td>
      <td>$${m.sales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>$${m.cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="${roasClass}">${m.roas.toFixed(2)}x</td>
      <td class="${acosClass}">${m.acos.toFixed(1)}%</td>
      <td>${m.orders.toLocaleString()}</td>
      <td>${m.clicks.toLocaleString()}</td>
      <td>${m.ctr.toFixed(2)}%</td>
    </tr>`;
  }

  private renderPortfolioScorecard(report: AnalysisReport): string {
    const rows = report.portfolioAnalyses
      .sort((a, b) => {
        const order = { red: 0, yellow: 1, green: 2 };
        return order[a.healthStatus] - order[b.healthStatus];
      })
      .map((pa) => this.renderPortfolioRow(pa))
      .join("");

    return `
<div class="section">
  <h2>Portfolio Scorecard (7-Day)</h2>
  <table>
    <tr>
      <th>Status</th>
      <th>Portfolio</th>
      <th>Sales</th>
      <th>Spend</th>
      <th>ROAS</th>
      <th>ACoS</th>
      <th>Issues</th>
    </tr>
    ${rows}
  </table>
</div>`;
  }

  private renderPortfolioRow(pa: PortfolioAnalysis): string {
    const m = pa.metrics.days7;
    return `
    <tr>
      <td><span class="status-dot status-${pa.healthStatus}"></span></td>
      <td><strong>${pa.portfolio.name}</strong></td>
      <td>$${m.sales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>$${m.cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>${m.roas.toFixed(2)}x</td>
      <td>${m.acos.toFixed(1)}%</td>
      <td>${pa.issues.length > 0 ? pa.issues.length + " issue" + (pa.issues.length > 1 ? "s" : "") : "—"}</td>
    </tr>`;
  }

  private renderProposedChanges(report: AnalysisReport): string {
    if (report.proposedChanges.length === 0) {
      return `
<div class="section">
  <h2>Proposed Changes</h2>
  <p>No changes recommended at this time. All campaigns are performing within target KPIs.</p>
</div>`;
    }

    const cards = report.proposedChanges
      .map((change) => this.renderChangeCard(change))
      .join("");

    return `
<div class="section">
  <h2>Proposed Changes (${report.proposedChanges.length})</h2>
  <p style="font-size: 13px; color: #666; margin-bottom: 15px;">Reply with the change numbers you approve (e.g., "Approve 1, 3, 5") or "Approve all".</p>
  ${cards}
  <div class="approval-note">
    <strong>How to approve:</strong> Reply to this email with the change numbers you want to execute.<br>
    Example: "Approve 1, 3, 5" or "Approve all" or "Deny all"
  </div>
</div>`;
  }

  private renderChangeCard(change: ProposedChange): string {
    const typeLabels: Record<string, string> = {
      bid_increase: "Bid Increase",
      bid_decrease: "Bid Decrease",
      budget_increase: "Budget Increase",
      budget_decrease: "Budget Decrease",
      pause: "Pause",
      enable: "Enable",
      add_negative: "Add Negative",
      structure: "Structure",
    };

    const valueStr =
      change.currentValue !== undefined && change.proposedValue !== undefined
        ? `$${change.currentValue.toFixed(2)} → $${change.proposedValue.toFixed(2)}`
        : "";

    return `
  <div class="change-card ${change.impact}">
    <div class="change-header">
      <div>
        <span class="change-id">#${change.id}</span>
        <span class="change-type">${typeLabels[change.type] || change.type}</span>
      </div>
      <span style="font-size: 11px; color: #888;">${change.impact.toUpperCase()} IMPACT</span>
    </div>
    <div class="change-entity">${change.entity}</div>
    <div style="font-size: 11px; color: #888;">${change.portfolioName} → ${change.campaignName}</div>
    ${valueStr ? `<div class="change-values">${valueStr}</div>` : ""}
    <div class="change-rationale">${change.rationale}</div>
  </div>`;
  }

  private renderNewToBrand(report: AnalysisReport): string {
    if (report.newToBrandInsights.length === 0) {
      return `
<div class="section">
  <h2>New-to-Brand Insights</h2>
  <p style="font-size: 13px; color: #666;">No Sponsored Brands campaigns with New-to-Brand data found. NTB metrics are available for Sponsored Brands campaigns.</p>
</div>`;
    }

    const rows = report.newToBrandInsights
      .map((insight) => this.renderNtbRow(insight))
      .join("");

    return `
<div class="section">
  <h2>New-to-Brand Insights</h2>
  <table>
    <tr>
      <th>Campaign</th>
      <th>Portfolio</th>
      <th>NTB Rate</th>
      <th>NTB Sales</th>
      <th>Total Sales</th>
      <th>Recommendation</th>
    </tr>
    ${rows}
  </table>
</div>`;
  }

  private renderNtbRow(insight: NewToBrandInsight): string {
    return `
    <tr>
      <td><strong>${insight.campaignName}</strong></td>
      <td>${insight.portfolioName}</td>
      <td>
        ${insight.ntbOrderRate.toFixed(1)}%
        <div class="ntb-bar"><div class="ntb-fill" style="width: ${Math.min(insight.ntbOrderRate, 100)}%"></div></div>
      </td>
      <td>$${insight.ntbSales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>$${insight.totalSales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="font-size: 12px;">${insight.recommendation}</td>
    </tr>`;
  }

  private renderStructureRecommendations(report: AnalysisReport): string {
    if (report.structureRecommendations.length === 0) return "";

    const items = report.structureRecommendations
      .map((rec) => `<div class="structure-rec">${rec}</div>`)
      .join("");

    return `
<div class="section">
  <h2>Campaign Structure Recommendations</h2>
  <p style="font-size: 13px; color: #666; margin-bottom: 12px;">These are strategic recommendations for improving your campaign architecture.</p>
  ${items}
</div>`;
  }

  private renderFooter(): string {
    return `
<div class="footer">
  <p>Generated by eatmyface.co Amazon Ads Agent &bull; Targets: ROAS ${KPI_TARGETS.ROAS_TARGET}x+ &bull; ACoS &lt;${KPI_TARGETS.ACOS_TARGET}% &bull; Daily Sales $${KPI_TARGETS.MIN_DAILY_SALES}+</p>
  <p>Reply to approve or deny proposed changes.</p>
</div>`;
  }

  buildPlainTextSummary(report: AnalysisReport): string {
    const m7 = report.accountSummary.days7;
    let text = `AMAZON ADS DAILY REPORT - ${new Date(report.generatedAt).toLocaleDateString()}\n`;
    text += `${"=".repeat(60)}\n\n`;
    text += `ACCOUNT SUMMARY (7-Day)\n`;
    text += `Sales: $${m7.sales.toFixed(2)} | Spend: $${m7.cost.toFixed(2)} | ROAS: ${m7.roas.toFixed(2)}x | ACoS: ${m7.acos.toFixed(1)}%\n\n`;

    text += `PORTFOLIOS\n`;
    for (const pa of report.portfolioAnalyses) {
      const status = pa.healthStatus === "green" ? "[OK]" : pa.healthStatus === "yellow" ? "[!!]" : "[XX]";
      text += `${status} ${pa.portfolio.name}: ROAS ${pa.metrics.days7.roas.toFixed(2)}x, ACoS ${pa.metrics.days7.acos.toFixed(1)}%\n`;
      for (const issue of pa.issues) {
        text += `    - ${issue}\n`;
      }
    }

    text += `\nPROPOSED CHANGES (${report.proposedChanges.length})\n`;
    for (const change of report.proposedChanges) {
      text += `#${change.id} [${change.impact.toUpperCase()}] ${change.type}: ${change.entity}\n`;
      text += `   ${change.rationale}\n`;
    }

    text += `\nReply with change numbers to approve (e.g., "Approve 1, 3, 5")\n`;
    return text;
  }
}
