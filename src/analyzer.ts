import type {
  Portfolio,
  CampaignMetrics,
  AdGroupMetrics,
  KeywordMetrics,
  PortfolioAnalysis,
  ProposedChange,
  AnalysisReport,
  NewToBrandInsight,
  PortfolioMetrics,
} from "./types.js";
import { KPI_TARGETS } from "./types.js";
import { aggregatePortfolioMetrics } from "./data-collector.js";

interface CollectedData {
  portfolios: Portfolio[];
  campaigns: Record<string, CampaignMetrics[]>;
  adGroups: Record<string, AdGroupMetrics[]>;
  keywords: Record<string, KeywordMetrics[]>;
}

export class Analyzer {
  private data: CollectedData;
  private changeCounter = 0;

  constructor(data: CollectedData) {
    this.data = data;
  }

  analyze(): AnalysisReport {
    const portfolioAnalyses = this.analyzePortfolios();
    const proposedChanges = this.generateProposedChanges();
    const newToBrandInsights = this.analyzeNewToBrand();
    const structureRecommendations = this.generateStructureRecommendations();

    const accountSummary = this.getAccountSummary();

    return {
      generatedAt: new Date().toISOString(),
      accountSummary,
      portfolioAnalyses,
      proposedChanges,
      newToBrandInsights,
      structureRecommendations,
    };
  }

  private getAccountSummary(): AnalysisReport["accountSummary"] {
    const windowMetrics = (windowKey: string): PortfolioMetrics => {
      const campaigns = this.data.campaigns[windowKey] || [];
      return aggregatePortfolioMetrics(campaigns);
    };

    return {
      yesterday: windowMetrics("YESTERDAY"),
      days7: windowMetrics("DAYS_7"),
      days14: windowMetrics("DAYS_14"),
      days30: windowMetrics("DAYS_30"),
    };
  }

  private analyzePortfolios(): PortfolioAnalysis[] {
    return this.data.portfolios.map((portfolio) => {
      const getCampaignsForPortfolio = (windowKey: string) =>
        (this.data.campaigns[windowKey] || []).filter(
          (c) => c.portfolioId === portfolio.portfolioId
        );

      const metrics = {
        yesterday: aggregatePortfolioMetrics(
          getCampaignsForPortfolio("YESTERDAY")
        ),
        days7: aggregatePortfolioMetrics(getCampaignsForPortfolio("DAYS_7")),
        days14: aggregatePortfolioMetrics(getCampaignsForPortfolio("DAYS_14")),
        days30: aggregatePortfolioMetrics(getCampaignsForPortfolio("DAYS_30")),
      };

      const issues = this.identifyPortfolioIssues(portfolio, metrics);
      const healthStatus = this.getHealthStatus(metrics.days7);

      return {
        portfolio,
        metrics,
        campaigns: getCampaignsForPortfolio("DAYS_7"),
        healthStatus,
        issues,
      };
    });
  }

  private getHealthStatus(
    metrics: PortfolioMetrics
  ): "green" | "yellow" | "red" {
    if (metrics.sales === 0 && metrics.cost === 0) return "green";
    if (
      metrics.roas >= KPI_TARGETS.ROAS_TARGET &&
      metrics.acos <= KPI_TARGETS.ACOS_TARGET
    ) {
      return "green";
    }
    if (
      metrics.roas >= KPI_TARGETS.ROAS_TARGET * 0.75 &&
      metrics.acos <= KPI_TARGETS.ACOS_TARGET * 1.2
    ) {
      return "yellow";
    }
    return "red";
  }

  private identifyPortfolioIssues(
    portfolio: Portfolio,
    metrics: {
      yesterday: PortfolioMetrics;
      days7: PortfolioMetrics;
      days14: PortfolioMetrics;
      days30: PortfolioMetrics;
    }
  ): string[] {
    const issues: string[] = [];
    const m7 = metrics.days7;
    const m30 = metrics.days30;

    if (m7.roas < KPI_TARGETS.ROAS_TARGET && m7.cost > 0) {
      issues.push(
        `7-day ROAS (${m7.roas.toFixed(2)}x) below target (${KPI_TARGETS.ROAS_TARGET}x)`
      );
    }

    if (m7.acos > KPI_TARGETS.ACOS_TARGET && m7.sales > 0) {
      issues.push(
        `7-day ACoS (${m7.acos.toFixed(1)}%) above target (${KPI_TARGETS.ACOS_TARGET}%)`
      );
    }

    const dailySales = m7.sales / 7;
    if (dailySales < KPI_TARGETS.MIN_DAILY_SALES && m7.cost > 0) {
      issues.push(
        `Avg daily sales ($${dailySales.toFixed(0)}) below target ($${KPI_TARGETS.MIN_DAILY_SALES})`
      );
    }

    // Trend detection: compare 7-day vs 30-day
    if (m30.roas > 0 && m7.roas > 0) {
      const roasTrend = ((m7.roas - m30.roas) / m30.roas) * 100;
      if (roasTrend < -20) {
        issues.push(
          `ROAS declining: 7-day (${m7.roas.toFixed(2)}x) vs 30-day (${m30.roas.toFixed(2)}x) — ${roasTrend.toFixed(0)}%`
        );
      }
    }

    if (m7.ctr < 0.2 && m7.impressions > 1000) {
      issues.push(
        `Very low CTR (${m7.ctr.toFixed(2)}%) — ads may not be relevant to search terms`
      );
    }

    return issues;
  }

  private generateProposedChanges(): ProposedChange[] {
    const changes: ProposedChange[] = [];

    // Analyze campaigns across windows
    this.analyzeCampaignChanges(changes);
    this.analyzeKeywordChanges(changes);

    // Sort by impact
    const impactOrder = { high: 0, medium: 1, low: 2 };
    changes.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

    return changes;
  }

  private analyzeCampaignChanges(changes: ProposedChange[]): void {
    const campaigns7d = this.data.campaigns["DAYS_7"] || [];
    const campaigns30d = this.data.campaigns["DAYS_30"] || [];

    const portfolio30dMap = new Map<number, CampaignMetrics[]>();
    for (const c of campaigns30d) {
      if (c.portfolioId) {
        const existing = portfolio30dMap.get(c.portfolioId) || [];
        existing.push(c);
        portfolio30dMap.set(c.portfolioId, existing);
      }
    }

    for (const campaign of campaigns7d) {
      const portfolioName = this.getPortfolioName(campaign.portfolioId);

      // High-spend, low-ROAS campaigns → budget decrease
      if (
        campaign.roas < KPI_TARGETS.ROAS_TARGET * 0.5 &&
        campaign.cost > 50 &&
        campaign.sales > 0
      ) {
        const newBudget = Math.round(campaign.budget * 0.75);
        changes.push({
          id: ++this.changeCounter,
          type: "budget_decrease",
          entity: campaign.campaignName,
          entityType: "campaign",
          currentValue: campaign.budget,
          proposedValue: newBudget,
          rationale: `ROAS ${campaign.roas.toFixed(2)}x is well below ${KPI_TARGETS.ROAS_TARGET}x target. ACoS at ${campaign.acos.toFixed(1)}%. Reducing budget 25% to limit waste while maintaining presence.`,
          impact: "high",
          portfolioName,
          campaignName: campaign.campaignName,
        });
      }

      // High-ROAS campaigns with budget that could be increased
      if (
        campaign.roas >= KPI_TARGETS.ROAS_TARGET * 1.5 &&
        campaign.sales > 100
      ) {
        const newBudget = Math.round(campaign.budget * 1.25);
        changes.push({
          id: ++this.changeCounter,
          type: "budget_increase",
          entity: campaign.campaignName,
          entityType: "campaign",
          currentValue: campaign.budget,
          proposedValue: newBudget,
          rationale: `Strong ROAS at ${campaign.roas.toFixed(2)}x (target: ${KPI_TARGETS.ROAS_TARGET}x). Increasing budget 25% to capture more sales at efficient spend.`,
          impact: "high",
          portfolioName,
          campaignName: campaign.campaignName,
        });
      }

      // Zero-sales campaigns with spend → consider pausing
      if (campaign.sales === 0 && campaign.cost > 30) {
        // Check 30-day data before recommending pause
        const campaign30d = campaigns30d.find(
          (c) => c.campaignId === campaign.campaignId
        );
        if (!campaign30d || campaign30d.sales === 0) {
          changes.push({
            id: ++this.changeCounter,
            type: "pause",
            entity: campaign.campaignName,
            entityType: "campaign",
            rationale: `No sales in 7-day or 30-day window despite $${campaign.cost.toFixed(2)} spend (7d). Consider pausing and reallocating budget.`,
            impact: "medium",
            portfolioName,
            campaignName: campaign.campaignName,
          });
        }
      }
    }
  }

  private analyzeKeywordChanges(changes: ProposedChange[]): void {
    const keywords7d = this.data.keywords["DAYS_7"] || [];
    const keywords30d = this.data.keywords["DAYS_30"] || [];

    for (const kw of keywords7d) {
      const portfolioName = this.getPortfolioNameByCampaign(kw.campaignId);

      // High-ACoS keywords → bid decrease
      if (
        kw.acos > KPI_TARGETS.ACOS_TARGET * 1.5 &&
        kw.cost > 10 &&
        kw.sales > 0
      ) {
        const kw30d = keywords30d.find((k) => k.keywordId === kw.keywordId);
        // Only act if 30-day data also shows poor performance
        if (kw30d && kw30d.acos > KPI_TARGETS.ACOS_TARGET) {
          const newBid = Math.round(kw.bid * 0.8 * 100) / 100;
          changes.push({
            id: ++this.changeCounter,
            type: "bid_decrease",
            entity: `"${kw.keywordText}" (${kw.matchType})`,
            entityType: "keyword",
            currentValue: kw.bid,
            proposedValue: newBid,
            rationale: `ACoS ${kw.acos.toFixed(1)}% (7d) / ${kw30d.acos.toFixed(1)}% (30d) consistently above ${KPI_TARGETS.ACOS_TARGET}% target. Reducing bid 20%.`,
            impact: "medium",
            portfolioName,
            campaignName: kw.campaignName,
          });
        }
      }

      // High-converting keywords with room to grow → bid increase
      if (
        kw.roas >= KPI_TARGETS.ROAS_TARGET * 1.5 &&
        kw.orders >= 3 &&
        kw.clicks > 10
      ) {
        const newBid = Math.round(kw.bid * 1.15 * 100) / 100;
        changes.push({
          id: ++this.changeCounter,
          type: "bid_increase",
          entity: `"${kw.keywordText}" (${kw.matchType})`,
          entityType: "keyword",
          currentValue: kw.bid,
          proposedValue: newBid,
          rationale: `Strong performer: ROAS ${kw.roas.toFixed(2)}x, ${kw.orders} orders. Increasing bid 15% to win more impressions.`,
          impact: "medium",
          portfolioName,
          campaignName: kw.campaignName,
        });
      }

      // Keywords with spend but zero conversions → negative keyword candidate
      if (kw.sales === 0 && kw.clicks > 20 && kw.cost > 15) {
        const kw30d = keywords30d.find((k) => k.keywordId === kw.keywordId);
        if (!kw30d || kw30d.orders === 0) {
          changes.push({
            id: ++this.changeCounter,
            type: "add_negative",
            entity: `"${kw.keywordText}"`,
            entityType: "keyword",
            rationale: `${kw.clicks} clicks, $${kw.cost.toFixed(2)} spend, 0 conversions over 7d (and 30d). Consider adding as negative keyword.`,
            impact: "low",
            portfolioName,
            campaignName: kw.campaignName,
          });
        }
      }
    }
  }

  private analyzeNewToBrand(): NewToBrandInsight[] {
    const insights: NewToBrandInsight[] = [];
    const campaigns7d = this.data.campaigns["DAYS_7"] || [];

    const sbCampaigns = campaigns7d.filter(
      (c) =>
        c.campaignType === "sponsoredBrands" &&
        c.newToBrandOrders !== undefined &&
        c.orders > 0
    );

    for (const campaign of sbCampaigns) {
      const portfolioName = this.getPortfolioName(campaign.portfolioId);
      const ntbRate = campaign.newToBrandOrderRate || 0;

      let recommendation = "";
      if (ntbRate > 70) {
        recommendation =
          "Strong new customer acquisition. Consider increasing budget to grow customer base.";
      } else if (ntbRate > 40) {
        recommendation =
          "Balanced mix of new and repeat customers. Good for sustainable growth.";
      } else if (ntbRate > 0) {
        recommendation =
          "Primarily driving repeat purchases. Consider Sponsored Brands with broader targeting to attract new customers.";
      }

      if (recommendation) {
        insights.push({
          campaignName: campaign.campaignName,
          portfolioName,
          ntbOrderRate: ntbRate,
          ntbSales: campaign.newToBrandSales || 0,
          totalSales: campaign.sales,
          recommendation,
        });
      }
    }

    // Sort by NTB rate descending
    insights.sort((a, b) => b.ntbOrderRate - a.ntbOrderRate);
    return insights;
  }

  private generateStructureRecommendations(): string[] {
    const recommendations: string[] = [];
    const campaigns7d = this.data.campaigns["DAYS_7"] || [];

    // Check if there are separate NTB vs repeat campaigns
    const hasNtbCampaigns = campaigns7d.some(
      (c) =>
        c.campaignName.toLowerCase().includes("ntb") ||
        c.campaignName.toLowerCase().includes("new to brand") ||
        c.campaignName.toLowerCase().includes("acquisition")
    );

    if (!hasNtbCampaigns) {
      recommendations.push(
        "STRUCTURE: Create separate 'New-to-Brand' Sponsored Brands campaigns with broad/category targeting to acquire new customers. Use Sponsored Brands video and Store Spotlight formats which tend to drive higher NTB rates."
      );
      recommendations.push(
        "STRUCTURE: Create 'Repeat Customer' campaigns with product targeting and branded keywords to capture returning shoppers at lower ACoS."
      );
    }

    // Check for auto vs manual campaign structure
    const hasAutoCampaigns = campaigns7d.some(
      (c) =>
        c.campaignName.toLowerCase().includes("auto") ||
        c.campaignName.toLowerCase().includes("automatic")
    );
    const hasManualCampaigns = campaigns7d.some(
      (c) =>
        c.campaignName.toLowerCase().includes("manual") ||
        c.campaignName.toLowerCase().includes("exact") ||
        c.campaignName.toLowerCase().includes("phrase")
    );

    if (hasAutoCampaigns && !hasManualCampaigns) {
      recommendations.push(
        "STRUCTURE: Harvest converting search terms from Auto campaigns into dedicated Manual Exact/Phrase campaigns for better bid control and efficiency."
      );
    }

    // Check for brand defense campaigns
    const hasBrandCampaigns = campaigns7d.some(
      (c) =>
        c.campaignName.toLowerCase().includes("brand") ||
        c.campaignName.toLowerCase().includes("defense") ||
        c.campaignName.toLowerCase().includes("branded")
    );

    if (!hasBrandCampaigns) {
      recommendations.push(
        "STRUCTURE: Create Brand Defense campaigns targeting your brand name and product names. These typically have very high ROAS (10x+) and protect against competitors bidding on your brand terms."
      );
    }

    return recommendations;
  }

  private getPortfolioName(portfolioId?: number): string {
    if (!portfolioId) return "Unassigned";
    const portfolio = this.data.portfolios.find(
      (p) => p.portfolioId === portfolioId
    );
    return portfolio?.name || `Portfolio ${portfolioId}`;
  }

  private getPortfolioNameByCampaign(campaignId: number): string {
    const campaigns = this.data.campaigns["DAYS_7"] || [];
    const campaign = campaigns.find((c) => c.campaignId === campaignId);
    return this.getPortfolioName(campaign?.portfolioId);
  }
}
