/**
 * Helper script to get an Amazon Ads API refresh token.
 *
 * PREREQUISITES:
 * 1. Register your app at https://advertising.amazon.com/api/developer
 *    (You need Amazon Ads API access — separate from Login with Amazon)
 * 2. Your app must have the "advertising::campaign_management" scope approved
 * 3. Add "https://www.amazon.com" as an Allowed Return URL in your LWA app settings
 *
 * USAGE:
 * 1. Run: npx tsx src/get-refresh-token.ts
 * 2. Open the URL printed in your browser
 * 3. Authorize the app
 * 4. Copy the "code" parameter from the redirect URL
 * 5. Paste it when prompted (or pass as argument: npx tsx src/get-refresh-token.ts YOUR_CODE)
 */

import * as readline from "readline";

const CLIENT_ID = process.env.AMAZON_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_ADS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set AMAZON_ADS_CLIENT_ID and AMAZON_ADS_CLIENT_SECRET environment variables first.");
  process.exit(1);
}
const REDIRECT_URI = "https://www.amazon.com";
const SCOPE = "advertising::campaign_management";

async function exchangeCodeForToken(code: string): Promise<void> {
  console.log("\nExchanging authorization code for tokens...\n");

  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("ERROR: Token exchange failed");
    console.error(JSON.stringify(data, null, 2));
    console.error(
      "\nIf you see 'invalid_grant', the code has expired (5 min). Get a new one."
    );
    console.error(
      "If you see 'unauthorized_client', your app needs Amazon Ads API registration."
    );
    process.exit(1);
  }

  console.log("SUCCESS! Here are your tokens:\n");
  console.log("Access Token:", (data as { access_token: string }).access_token);
  console.log(
    "\nRefresh Token:",
    (data as { refresh_token: string }).refresh_token
  );
  console.log(
    "\nIMPORTANT: Save the refresh token — it does not expire."
  );
  console.log(
    "Set it as: AMAZON_ADS_REFRESH_TOKEN=" +
      (data as { refresh_token: string }).refresh_token
  );
}

async function main(): Promise<void> {
  const codeArg = process.argv[2];

  if (!codeArg) {
    const authUrl = `https://www.amazon.com/ap/oa?client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPE)}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    console.log("Amazon Ads API — Refresh Token Helper");
    console.log("=".repeat(50));
    console.log("\nStep 1: Open this URL in your browser:\n");
    console.log(authUrl);
    console.log("\nStep 2: Authorize the app");
    console.log(
      'Step 3: Copy the "code" from the redirect URL (e.g., ?code=ANdNAVhyhq...)'
    );
    console.log("\nStep 4: Paste the code below:\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Authorization code: ", async (code) => {
      rl.close();
      if (!code.trim()) {
        console.error("No code provided. Exiting.");
        process.exit(1);
      }
      await exchangeCodeForToken(code.trim());
    });
  } else {
    await exchangeCodeForToken(codeArg);
  }
}

main().catch(console.error);
