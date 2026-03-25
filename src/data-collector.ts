import { AmazonAdsClient } from "./amazon-ads-client.js";
import type {
  Portfolio,
  PortfolioMetrics,
  CampaignMetrics,
  AdGroupMetrics,
  KeywordMetrics,
} from "./types.js";
import { ROLLING_WINDOWS } from "./types.js";

export class DataCollector {
  private client: AmazonAdsClient;

  constructor(client: AmazonAdsClient) {
    this.client = client;
  }

  private formatDate(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split("T")[0];
  }

  private getDateRange(daysBack: number): { startDate: string; endDate: string } {
    return {
      startDate: this.formatDate(daysBack),
      endDate: this.formatDate(1), // yesterday
    };
  }

  async collectPortfolios(): Promise<Portfolio[]> {
    console.log("Fetching portfolios...");
    const portfolios = await this.client.getPortfolios();
    console.log(`Found ${portfolios.length} portfolios`);
    return portfolios;
  }

  async collectCampaignMetrics(
    daysBack: number
  ): Promise<CampaignMetrics[]> {
    const { startDate, endDate } = this.getDateRange(daysBack);
    console.log(`Collecting campaign metrics: ${startDate} to ${endDate}`);

    // Fetch SP and SB campaign reports in parallel
    const [spReportId, sbReportId] = await Promise.all([
      this.client.requestSPReport("campaigns", startDate, endDate),
      this.client.requestSBReport("campaigns", startDate, endDate),
    ]);

    const [spData, sbData] = await Promise.all([
      this.client.waitForReport(spReportId.reportId),
      this.client.waitForReport(sbReportId.reportId),
    ]);

    const spCampaigns = this.parseSPCampaignData(spData);
    const sbCampaigns = this.parseSBCampaignData(sbData);

    return [...spCampaigns, ...sbCampaigns];
  }

  async collectAdGroupMetrics(
    daysBack: number
  ): Promise<AdGroupMetrics[]> {
    const { startDate, endDate } = this.getDateRange(daysBack);
    console.log(`Collecting ad group metrics: ${startDate} to ${endDate}`);

    const reportId = await this.client.requestSPReport(
      "adGroups",
      startDate,
      endDate
    );
    const data = await this.client.waitForReport(reportId.reportId);
    return this.parseAdGroupData(data);
  }

  async collectKeywordMetrics(
    daysBack: number
  ): Promise<KeywordMetrics[]> {
    const { startDate, endDate } = this.getDateRange(daysBack);
    console.log(`Collecting keyword metrics: ${startDate} to ${endDate}`);

    const [spReportId, sbReportId] = await Promise.all([
      this.client.requestSPReport("keywords", startDate, endDate),
      this.client.requestSBReport("keywords", startDate, endDate),
    ]);

    const [spData, sbData] = await Promise.all([
      this.client.waitForReport(spReportId.reportId),
      this.client.waitForReport(sbReportId.reportId),
    ]);

    return [...this.parseKeywordData(spData), ...this.parseKeywordData(sbData)];
  }

  async collectAllWindows(): Promise<{
    portfolios: Portfolio[];
    campaigns: Record<string, CampaignMetrics[]>;
    adGroups: Record<string, AdGroupMetrics[]>;
    keywords: Record<string, KeywordMetrics[]>;
  }> {
    const portfolios = await this.collectPortfolios();

    const windows = Object.entries(ROLLING_WINDOWS);
    const campaigns: Record<string, CampaignMetrics[]> = {};
    const adGroups: Record<string, AdGroupMetrics[]> = {};
    const keywords: Record<string, KeywordMetrics[]> = {};

    for (const [windowName, days] of windows) {
      console.log(`\n--- Collecting ${windowName} data (${days} days) ---`);
      campaigns[windowName] = await this.collectCampaignMetrics(days);
      adGroups[windowName] = await this.collectAdGroupMetrics(days);
      keywords[windowName] = await this.collectKeywordMetrics(days);
    }

    return { portfolios, campaigns, adGroups, keywords };
  }

  // --- Data Parsing ---

  private calcMetrics(row: Record<string, unknown>): {
    impressions: number;
    clicks: number;
    cost: number;
    sales: number;
    orders: number;
    acos: number;
    roas: number;
    ctr: number;
    cpc: number;
    conversionRate: number;
  } {
    const impressions = Number(row.impressions) || 0;
    const clicks = Number(row.clicks) || 0;
    const cost = Number(row.cost) || 0;
    const sales =
      Number(row.sales14d) ||
      Number(row.attributedSales14d) ||
      Number(row.sales7d) ||
      0;
    const orders =
      Number(row.purchases14d) ||
      Number(row.attributedConversions14d) ||
      Number(row.purchases7d) ||
      0;

    return {
      impressions,
      clicks,
      cost,
      sales,
      orders,
      acos: sales > 0 ? (cost / sales) * 100 : 0,
      roas: cost > 0 ? sales / cost : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
      conversionRate: clicks > 0 ? (orders / clicks) * 100 : 0,
    };
  }

  private parseSPCampaignData(data: unknown[]): CampaignMetrics[] {
    return (data as Record<string, unknown>[]).map((row) => {
      const metrics = this.calcMetrics(row);
      return {
        campaignId: Number(row.campaignId),
        campaignName: String(row.campaignName),
        campaignType: "sponsoredProducts" as const,
        portfolioId: row.portfolioId ? Number(row.portfolioId) : undefined,
        state: String(row.campaignStatus || "enabled"),
        budget: Number(row.campaignBudgetAmount) || 0,
        ...metrics,
      };
    });
  }

  private parseSBCampaignData(data: unknown[]): CampaignMetrics[] {
    return (data as Record<string, unknown>[]).map((row) => {
      const metrics = this.calcMetrics(row);
      return {
        campaignId: Number(row.campaignId),
        campaignName: String(row.campaignName),
        campaignType: "sponsoredBrands" as const,
        portfolioId: row.portfolioId ? Number(row.portfolioId) : undefined,
        state: String(row.campaignStatus || "enabled"),
        budget: Number(row.campaignBudgetAmount) || 0,
        ...metrics,
        newToBrandOrders: Number(row.attributedOrdersNewToBrand14d) || 0,
        newToBrandSales: Number(row.attributedSalesNewToBrand14d) || 0,
        newToBrandOrderRate:
          Number(row.attributedConversions14d) > 0
            ? (Number(row.attributedOrdersNewToBrand14d) /
                Number(row.attributedConversions14d)) *
              100
            : 0,
      };
    });
  }

  private parseAdGroupData(data: unknown[]): AdGroupMetrics[] {
    return (data as Record<string, unknown>[]).map((row) => {
      const metrics = this.calcMetrics(row);
      return {
        adGroupId: Number(row.adGroupId),
        adGroupName: String(row.adGroupName),
        campaignId: Number(row.campaignId),
        campaignName: String(row.campaignName),
        state: String(row.state || "enabled"),
        defaultBid: Number(row.defaultBid) || 0,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        cost: metrics.cost,
        sales: metrics.sales,
        orders: metrics.orders,
        acos: metrics.acos,
        roas: metrics.roas,
      };
    });
  }

  private parseKeywordData(data: unknown[]): KeywordMetrics[] {
    return (data as Record<string, unknown>[]).map((row) => {
      const metrics = this.calcMetrics(row);
      return {
        keywordId: Number(row.keywordId),
        keywordText: String(row.keyword || row.keywordText),
        matchType: String(row.matchType),
        adGroupId: Number(row.adGroupId),
        adGroupName: String(row.adGroupName),
        campaignId: Number(row.campaignId),
        campaignName: String(row.campaignName),
        bid: Number(row.keywordBid || row.bid) || 0,
        state: String(row.state || "enabled"),
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        cost: metrics.cost,
        sales: metrics.sales,
        orders: metrics.orders,
        acos: metrics.acos,
        roas: metrics.roas,
        cpc: metrics.cpc,
      };
    });
  }
}

// Helper to aggregate metrics across campaigns for a portfolio
export function aggregatePortfolioMetrics(
  campaigns: CampaignMetrics[]
): PortfolioMetrics {
  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      cost: acc.cost + c.cost,
      sales: acc.sales + c.sales,
      orders: acc.orders + c.orders,
    }),
    { impressions: 0, clicks: 0, cost: 0, sales: 0, orders: 0 }
  );

  return {
    ...totals,
    acos: totals.sales > 0 ? (totals.cost / totals.sales) * 100 : 0,
    roas: totals.cost > 0 ? totals.sales / totals.cost : 0,
    ctr:
      totals.impressions > 0
        ? (totals.clicks / totals.impressions) * 100
        : 0,
    cpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
  };
}
