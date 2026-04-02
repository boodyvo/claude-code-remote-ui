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
        const oauth = creds.claudeAiOauth;
        if (oauth?.accessToken) {
          // Check if token is expired
          const isExpired = oauth.expiresAt && Date.now() >= oauth.expiresAt;
          if (!isExpired) {
            return NextResponse.json({ authenticated: true, method: "oauth" });
          }
          // Token expired but refresh token exists — CLI can auto-refresh
          if (oauth.refreshToken) {
            return NextResponse.json({ authenticated: true, method: "oauth_refreshable" });
          }
        }
        if (creds.oauthAccessToken) {
          return NextResponse.json({ authenticated: true, method: "oauth" });
        }
      } catch {
        // Invalid credentials file
      }
    }
  }

  // Also check settings.json for env-based auth tokens
  const settingsPath = join(homedir(), ".claude", "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      if (settings.env?.ANTHROPIC_API_KEY || settings.env?.ANTHROPIC_AUTH_TOKEN) {
        return NextResponse.json({ authenticated: true, method: "settings_env" });
      }
    } catch {
      // Invalid settings file
    }
  }

  return NextResponse.json({ authenticated: false });
}
