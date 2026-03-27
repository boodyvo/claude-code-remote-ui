import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export async function GET() {
  // Check if ANTHROPIC_API_KEY is set
  if (process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ authenticated: true, method: "api_key" });
  }

  // Check Claude Code OAuth credentials (both possible filenames)
  const credentialsPaths = [
    join(homedir(), ".claude", "credentials.json"),
    join(homedir(), ".claude", ".credentials.json"),
  ];

  for (const credentialsPath of credentialsPaths) {
    if (existsSync(credentialsPath)) {
      try {
        const creds = JSON.parse(readFileSync(credentialsPath, "utf-8"));
        if (creds.claudeAiOauth?.accessToken || creds.oauthAccessToken) {
          return NextResponse.json({ authenticated: true, method: "oauth" });
        }
      } catch {
        // Invalid credentials file
      }
    }
  }

  return NextResponse.json({ authenticated: false });
}
