/**
 * Test script to verify Amazon Ads API connection.
 *
 * Usage: AMAZON_ADS_CLIENT_ID=xxx AMAZON_ADS_CLIENT_SECRET=xxx AMAZON_ADS_REFRESH_TOKEN=xxx npx tsx src/test-api-connection.ts
 */

import { AmazonAdsClient } from "./amazon-ads-client.js";

async function main(): Promise<void> {
  const clientId = process.env.AMAZON_ADS_CLIENT_ID;
  const clientSecret = process.env.AMAZON_ADS_CLIENT_SECRET;
  const refreshToken = process.env.AMAZON_ADS_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error("Missing required environment variables.");
    console.error("Set: AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET, AMAZON_ADS_REFRESH_TOKEN");
    process.exit(1);
  }

  console.log("Testing Amazon Ads API connection...\n");

  const client = new AmazonAdsClient({
    clientId,
    clientSecret,
    refreshToken,
    region: "NA",
  });

  // Test 1: Token refresh
  console.log("1. Testing token refresh...");
  try {
    const token = await client.refreshAccessToken();
    console.log(`   OK — Got access token (${token.substring(0, 20)}...)\n`);
  } catch (err) {
    console.error(`   FAILED — ${err}`);
    console.error("\n   This usually means:");
    console.error("   - Your refresh token is invalid or expired");
    console.error("   - Your client ID/secret is wrong");
    console.error("   - Your app doesn't have Amazon Ads API access");
    process.exit(1);
  }

  // Test 2: Get profiles
  console.log("2. Fetching advertising profiles...");
  try {
    const profiles = await client.getProfiles();
    console.log(`   OK — Found ${profiles.length} profile(s):\n`);
    for (const p of profiles) {
      console.log(
        `   - ${p.accountInfo.name} (ID: ${p.profileId}, ${p.countryCode}, ${p.accountInfo.type})`
      );
    }
  } catch (err) {
    console.error(`   FAILED — ${err}`);
    console.error("\n   This usually means:");
    console.error("   - Your token doesn't have the advertising scope");
    console.error("   - Your app needs Amazon Ads API developer registration");
    process.exit(1);
  }

  // Test 3: Get portfolios
  console.log("\n3. Fetching portfolios...");
  try {
    await client.autoSelectProfile();
    const portfolios = await client.getPortfolios();
    console.log(`   OK — Found ${portfolios.length} portfolio(s):\n`);
    for (const p of portfolios) {
      console.log(`   - ${p.name} (ID: ${p.portfolioId}, State: ${p.state})`);
    }
  } catch (err) {
    console.error(`   FAILED — ${err}`);
  }

  console.log("\n✓ API connection test complete.");
}

main().catch(console.error);
