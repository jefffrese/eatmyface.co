import fetch from "node-fetch";
import type {
  AmazonAdsConfig,
  TokenResponse,
  AdsProfile,
  Portfolio,
} from "./types.js";

const REGIONS = {
  NA: {
    tokenUrl: "https://api.amazon.com/auth/o2/token",
    apiUrl: "https://advertising-api.amazon.com",
  },
  EU: {
    tokenUrl: "https://api.amazon.co.uk/auth/o2/token",
    apiUrl: "https://advertising-api-eu.amazon.com",
  },
  FE: {
    tokenUrl: "https://api.amazon.co.jp/auth/o2/token",
    apiUrl: "https://advertising-api-fe.amazon.com",
  },
} as const;

export class AmazonAdsClient {
  private config: AmazonAdsConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private profileId: number | null = null;

  constructor(config: AmazonAdsConfig) {
    this.config = config;
  }

  private get regionConfig() {
    return REGIONS[this.config.region];
  }

  async refreshAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch(this.regionConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${error}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  async getProfiles(): Promise<AdsProfile[]> {
    const token = await this.refreshAccessToken();
    const response = await fetch(`${this.regionConfig.apiUrl}/v2/profiles`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Amazon-Advertising-API-ClientId": this.config.clientId,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get profiles (${response.status}): ${error}`);
    }

    return (await response.json()) as AdsProfile[];
  }

  async setProfile(profileId: number): Promise<void> {
    this.profileId = profileId;
  }

  async autoSelectProfile(): Promise<AdsProfile> {
    const profiles = await this.getProfiles();
    if (profiles.length === 0) {
      throw new Error("No advertising profiles found for this account");
    }
    // Prefer seller profiles, then vendor
    const seller = profiles.find((p) => p.accountInfo.type === "seller");
    const selected = seller || profiles[0];
    this.profileId = selected.profileId;
    console.log(
      `Selected profile: ${selected.accountInfo.name} (${selected.profileId}) - ${selected.countryCode}`
    );
    return selected;
  }

  private async apiRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      version?: string;
    } = {}
  ): Promise<T> {
    if (!this.profileId) {
      throw new Error("Profile not set. Call setProfile() or autoSelectProfile() first.");
    }

    const token = await this.refreshAccessToken();
    const version = options.version || "v2";

    const response = await fetch(
      `${this.regionConfig.apiUrl}/${version}/${endpoint}`,
      {
        method: options.method || "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Amazon-Advertising-API-ClientId": this.config.clientId,
          "Amazon-Advertising-API-Scope": this.profileId.toString(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `API request failed: ${options.method || "GET"} ${endpoint} (${response.status}): ${error}`
      );
    }

    return (await response.json()) as T;
  }

  // --- Portfolios ---

  async getPortfolios(): Promise<Portfolio[]> {
    return this.apiRequest<Portfolio[]>("portfolios/extended");
  }

  // --- Sponsored Products Reports ---

  async requestSPReport(
    recordType: "campaigns" | "adGroups" | "keywords",
    startDate: string,
    endDate: string
  ): Promise<{ reportId: string }> {
    return this.apiRequest<{ reportId: string }>(
      "sp/report",
      {
        method: "POST",
        version: "reporting",
        body: {
          reportDate: undefined,
          configuration: {
            adProduct: "SPONSORED_PRODUCTS",
            groupBy: [recordType === "campaigns" ? "campaign" : recordType === "adGroups" ? "adGroup" : "targeting"],
            columns: this.getSPReportColumns(recordType),
            reportTypeId: "spCampaigns",
            timeUnit: "SUMMARY",
            format: "GZIP_JSON",
          },
          startDate,
          endDate,
        },
      }
    );
  }

  private getSPReportColumns(
    recordType: "campaigns" | "adGroups" | "keywords"
  ): string[] {
    const baseMetrics = [
      "impressions",
      "clicks",
      "cost",
      "purchases1d",
      "purchases7d",
      "purchases14d",
      "purchases30d",
      "sales1d",
      "sales7d",
      "sales14d",
      "sales30d",
    ];

    switch (recordType) {
      case "campaigns":
        return [
          "campaignId",
          "campaignName",
          "campaignStatus",
          "campaignBudgetAmount",
          "portfolioId",
          ...baseMetrics,
        ];
      case "adGroups":
        return [
          "adGroupId",
          "adGroupName",
          "campaignId",
          "campaignName",
          ...baseMetrics,
        ];
      case "keywords":
        return [
          "keywordId",
          "keyword",
          "matchType",
          "adGroupId",
          "adGroupName",
          "campaignId",
          "campaignName",
          "keywordBid",
          ...baseMetrics,
        ];
    }
  }

  // --- Sponsored Brands Reports ---

  async requestSBReport(
    recordType: "campaigns" | "keywords",
    startDate: string,
    endDate: string
  ): Promise<{ reportId: string }> {
    const columns = [
      ...(recordType === "campaigns"
        ? ["campaignId", "campaignName", "campaignStatus", "campaignBudgetAmount", "portfolioId"]
        : ["keywordId", "keywordText", "matchType", "campaignId", "campaignName"]),
      "impressions",
      "clicks",
      "cost",
      "attributedSales14d",
      "attributedConversions14d",
      // New-to-Brand metrics
      "attributedOrdersNewToBrand14d",
      "attributedSalesNewToBrand14d",
    ];

    return this.apiRequest<{ reportId: string }>(
      "sb/report",
      {
        method: "POST",
        version: "reporting",
        body: {
          configuration: {
            adProduct: "SPONSORED_BRANDS",
            groupBy: [recordType === "campaigns" ? "campaign" : "targeting"],
            columns,
            reportTypeId: "sbCampaigns",
            timeUnit: "SUMMARY",
            format: "GZIP_JSON",
          },
          startDate,
          endDate,
        },
      }
    );
  }

  // --- Report Download ---

  async getReportStatus(
    reportId: string
  ): Promise<{ status: string; url?: string }> {
    return this.apiRequest<{ status: string; url?: string }>(
      `reports/${reportId}`,
      { version: "reporting" }
    );
  }

  async waitForReport(
    reportId: string,
    maxWaitMs: number = 120000
  ): Promise<unknown[]> {
    const startTime = Date.now();
    let pollInterval = 2000;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getReportStatus(reportId);

      if (status.status === "COMPLETED" && status.url) {
        return this.downloadReport(status.url);
      }

      if (status.status === "FAILED") {
        throw new Error(`Report ${reportId} failed`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      pollInterval = Math.min(pollInterval * 1.5, 10000);
    }

    throw new Error(`Report ${reportId} timed out after ${maxWaitMs}ms`);
  }

  private async downloadReport(url: string): Promise<unknown[]> {
    const token = await this.refreshAccessToken();
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Amazon-Advertising-API-ClientId": this.config.clientId,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download report: ${response.status}`);
    }

    // The API returns gzipped JSON; node-fetch handles decompression
    return (await response.json()) as unknown[];
  }

  // --- Campaign Management (for proposed changes) ---

  async updateSPCampaign(
    campaignId: number,
    updates: { budget?: number; state?: string }
  ): Promise<unknown> {
    return this.apiRequest("sp/campaigns", {
      method: "PUT",
      body: [{ campaignId, ...updates }],
    });
  }

  async updateSPKeywordBid(
    keywordId: number,
    bid: number
  ): Promise<unknown> {
    return this.apiRequest("sp/keywords", {
      method: "PUT",
      body: [{ keywordId, bid }],
    });
  }

  async addSPNegativeKeyword(
    campaignId: number,
    keywordText: string,
    matchType: "negativeExact" | "negativePhrase"
  ): Promise<unknown> {
    return this.apiRequest("sp/negativeKeywords", {
      method: "POST",
      body: [{ campaignId, keywordText, matchType, state: "enabled" }],
    });
  }
}
