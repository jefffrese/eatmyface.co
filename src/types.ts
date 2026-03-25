// Amazon Ads API Types

export interface AmazonAdsConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  region: "NA" | "EU" | "FE";
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AdsProfile {
  profileId: number;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  accountInfo: {
    marketplaceStringId: string;
    id: string;
    type: string;
    name: string;
  };
}

export interface Portfolio {
  portfolioId: number;
  name: string;
  budget?: {
    amount: number;
    currencyCode: string;
    policy: string;
  };
  state: string;
}

export interface CampaignMetrics {
  campaignId: number;
  campaignName: string;
  campaignType: "sponsoredProducts" | "sponsoredBrands";
  portfolioId?: number;
  state: string;
  budget: number;
  bidding?: {
    strategy: string;
  };
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
  // Sponsored Brands specific
  newToBrandOrders?: number;
  newToBrandSales?: number;
  newToBrandOrderRate?: number;
}

export interface AdGroupMetrics {
  adGroupId: number;
  adGroupName: string;
  campaignId: number;
  campaignName: string;
  state: string;
  defaultBid: number;
  impressions: number;
  clicks: number;
  cost: number;
  sales: number;
  orders: number;
  acos: number;
  roas: number;
}

export interface KeywordMetrics {
  keywordId: number;
  keywordText: string;
  matchType: string;
  adGroupId: number;
  adGroupName: string;
  campaignId: number;
  campaignName: string;
  bid: number;
  state: string;
  impressions: number;
  clicks: number;
  cost: number;
  sales: number;
  orders: number;
  acos: number;
  roas: number;
  cpc: number;
}

export interface PortfolioAnalysis {
  portfolio: Portfolio;
  metrics: {
    yesterday: PortfolioMetrics;
    days7: PortfolioMetrics;
    days14: PortfolioMetrics;
    days30: PortfolioMetrics;
  };
  campaigns: CampaignMetrics[];
  healthStatus: "green" | "yellow" | "red";
  issues: string[];
}

export interface PortfolioMetrics {
  impressions: number;
  clicks: number;
  cost: number;
  sales: number;
  orders: number;
  acos: number;
  roas: number;
  ctr: number;
  cpc: number;
}

export interface ProposedChange {
  id: number;
  type: "bid_increase" | "bid_decrease" | "budget_increase" | "budget_decrease" | "pause" | "enable" | "add_negative" | "structure";
  entity: string;
  entityType: "campaign" | "ad_group" | "keyword";
  currentValue?: number;
  proposedValue?: number;
  rationale: string;
  impact: "high" | "medium" | "low";
  portfolioName: string;
  campaignName: string;
}

export interface AnalysisReport {
  generatedAt: string;
  accountSummary: {
    yesterday: PortfolioMetrics;
    days7: PortfolioMetrics;
    days14: PortfolioMetrics;
    days30: PortfolioMetrics;
  };
  portfolioAnalyses: PortfolioAnalysis[];
  proposedChanges: ProposedChange[];
  newToBrandInsights: NewToBrandInsight[];
  structureRecommendations: string[];
}

export interface NewToBrandInsight {
  campaignName: string;
  portfolioName: string;
  ntbOrderRate: number;
  ntbSales: number;
  totalSales: number;
  recommendation: string;
}

// KPI Targets
export const KPI_TARGETS = {
  ROAS_TARGET: 4,
  ACOS_TARGET: 35,
  MIN_DAILY_SALES: 1000,
} as const;

// Rolling window periods in days
export const ROLLING_WINDOWS = {
  YESTERDAY: 1,
  DAYS_7: 7,
  DAYS_14: 14,
  DAYS_30: 30,
} as const;

export type RollingWindow = keyof typeof ROLLING_WINDOWS;
