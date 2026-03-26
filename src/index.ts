import { AmazonAdsClient } from "./amazon-ads-client.js";
import { DataCollector } from "./data-collector.js";
import { Analyzer } from "./analyzer.js";
import { ReportBuilder } from "./report-builder.js";
import type { AmazonAdsConfig, AnalysisReport } from "./types.js";

function getConfig(): AmazonAdsConfig {
  const clientId = process.env.AMAZON_ADS_CLIENT_ID;
  const clientSecret = process.env.AMAZON_ADS_CLIENT_SECRET;
  const refreshToken = process.env.AMAZON_ADS_REFRESH_TOKEN;
  const region = (process.env.AMAZON_ADS_REGION as "NA" | "EU" | "FE") || "NA";

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing required environment variables: AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET, AMAZON_ADS_REFRESH_TOKEN"
    );
  }

  return { clientId, clientSecret, refreshToken, region };
}

export async function runAnalysis(): Promise<AnalysisReport> {
  console.log("Starting Amazon Ads daily analysis...\n");

  // Initialize client
  const config = getConfig();
  const client = new AmazonAdsClient(config);

  // Auto-discover profile
  await client.autoSelectProfile();

  // Collect data across all rolling windows
  const collector = new DataCollector(client);
  const data = await collector.collectAllWindows();

  // Analyze
  const analyzer = new Analyzer(data);
  const report = analyzer.analyze();

  // Build report
  const reportBuilder = new ReportBuilder();
  const html = reportBuilder.buildHtmlEmail(report);
  const plainText = reportBuilder.buildPlainTextSummary(report);

  console.log("\n" + plainText);
  console.log("\nAnalysis complete. Report ready to send.");

  return report;
}

// Export for use by the scheduled agent
export { AmazonAdsClient, DataCollector, Analyzer, ReportBuilder };

// Run if called directly
const isMainModule = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMainModule) {
  runAnalysis().catch((err) => {
    console.error("Analysis failed:", err);
    process.exit(1);
  });
}
