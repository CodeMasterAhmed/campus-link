import "dotenv/config";

function decodeGoogleAuthError(encoded: string | null): string {
  if (!encoded) return "";
  try {
    const decoded = Buffer.from(decodeURIComponent(encoded), "base64").toString("utf8");
    return decoded;
  } catch {
    return "";
  }
}

async function run() {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3001";
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in environment.");
    process.exit(1);
  }

  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfRes.ok) {
    throw new Error(`Could not reach ${baseUrl}/api/auth/csrf (status ${csrfRes.status})`);
  }

  const csrfData = (await csrfRes.json()) as { csrfToken?: string };
  const csrfToken = csrfData.csrfToken;
  const cookie = csrfRes.headers.get("set-cookie")?.split(";")[0] ?? "";
  if (!csrfToken || !cookie) {
    throw new Error("Failed to load NextAuth CSRF token/cookie.");
  }

  const signInBody = new URLSearchParams({
    csrfToken,
    callbackUrl: `${baseUrl}/dashboard`,
    json: "true",
  });

  const signInRes = await fetch(`${baseUrl}/api/auth/signin/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
    },
    body: signInBody,
  });

  if (!signInRes.ok) {
    throw new Error(`NextAuth signIn endpoint failed (status ${signInRes.status})`);
  }

  const signInJson = (await signInRes.json()) as { url?: string };
  if (!signInJson.url) {
    throw new Error("Google sign-in URL was not returned.");
  }

  const oauthUrl = new URL(signInJson.url);
  const redirectUri = oauthUrl.searchParams.get("redirect_uri");
  console.log("Configured redirect_uri:", redirectUri ?? "<missing>");

  const oauthRes = await fetch(signInJson.url, { redirect: "manual" });
  const location = oauthRes.headers.get("location");
  if (!location) {
    console.error("Google did not return a redirect location.");
    process.exit(1);
  }

  const redirectLocation = new URL(location);
  const authError = redirectLocation.searchParams.get("authError");
  const decodedError = decodeGoogleAuthError(authError);

  if (decodedError.includes("redirect_uri_mismatch")) {
    console.error("Google OAuth failed: redirect_uri_mismatch");
    console.error("Decoded error:", decodedError.replace(/\s+/g, " ").trim());
    process.exit(1);
  }

  if (redirectLocation.pathname.includes("/signin/oauth/error")) {
    console.error("Google OAuth returned an error redirect.");
    console.error(
      "Decoded error:",
      decodedError ? decodedError.replace(/\s+/g, " ").trim() : "<unavailable>"
    );
    process.exit(1);
  }

  console.log("Google OAuth redirect pre-check passed.");
}

run().catch((error) => {
  console.error("Google OAuth pre-check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
