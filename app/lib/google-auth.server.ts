import { createCookieSessionStorage, redirect } from "react-router";
import { db } from "~/db.server";
import { createCustomerSession } from "~/lib/session.server";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";
const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const oauthStateStorage = createCookieSessionStorage({
  cookie: {
    name: "__oauth_state",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
  },
});

export function isGoogleOAuthConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function safeRedirectPath(path: string | null | undefined, fallback = "/account") {
  if (path && path.startsWith("/") && !path.startsWith("//")) {
    return path;
  }
  return fallback;
}

export function getGoogleRedirectUri() {
  return `${APP_URL}/auth/google/callback`;
}

export function buildGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

async function exchangeCodeForUser(code: string): Promise<GoogleUserInfo> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    throw new Error("Failed to exchange Google authorization code.");
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error("Google did not return an access token.");
  }

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error("Failed to fetch Google user profile.");
  }

  return userRes.json() as Promise<GoogleUserInfo>;
}

export async function findOrCreateGoogleCustomer(profile: GoogleUserInfo) {
  if (!profile.sub) {
    throw new Error("Google profile is missing a user id.");
  }

  if (!profile.email) {
    throw new Error("Google did not provide an email address.");
  }

  if (profile.email_verified === false) {
    throw new Error("Your Google email must be verified.");
  }

  const email = profile.email.toLowerCase();
  const byGoogleId = await db.customer.findUnique({ where: { googleId: profile.sub } });
  if (byGoogleId) {
    if (profile.picture && byGoogleId.avatarUrl !== profile.picture) {
      return db.customer.update({
        where: { id: byGoogleId.id },
        data: { avatarUrl: profile.picture, name: byGoogleId.name || profile.name || null },
      });
    }
    return byGoogleId;
  }

  const byEmail = await db.customer.findUnique({ where: { email } });
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.sub) {
      throw new Error("This email is linked to a different Google account.");
    }
    return db.customer.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.sub,
        avatarUrl: profile.picture ?? byEmail.avatarUrl,
        name: byEmail.name || profile.name || null,
      },
    });
  }

  return db.customer.create({
    data: {
      email,
      googleId: profile.sub,
      avatarUrl: profile.picture ?? null,
      name: profile.name || null,
      marketingOptIn: false,
    },
  });
}

export async function startGoogleOAuth(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    throw redirect("/auth/login?error=google_not_configured");
  }

  const url = new URL(request.url);
  const redirectTo = safeRedirectPath(url.searchParams.get("redirectTo"));
  const state = crypto.randomUUID();
  const session = await oauthStateStorage.getSession();
  session.set("state", state);
  session.set("redirectTo", redirectTo);

  throw redirect(buildGoogleAuthUrl(state), {
    headers: {
      "Set-Cookie": await oauthStateStorage.commitSession(session),
    },
  });
}

export async function completeGoogleOAuth(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const oauthSession = await oauthStateStorage.getSession(request.headers.get("Cookie"));
  const expectedState = oauthSession.get("state") as string | undefined;
  const redirectTo = safeRedirectPath(oauthSession.get("redirectTo") as string | undefined);
  const clearOAuthCookie = {
    "Set-Cookie": await oauthStateStorage.destroySession(oauthSession),
  };

  if (oauthError) {
    throw redirect(`/auth/login?error=google_denied&redirectTo=${encodeURIComponent(redirectTo)}`, {
      headers: clearOAuthCookie,
    });
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    throw redirect(`/auth/login?error=google_state&redirectTo=${encodeURIComponent(redirectTo)}`, {
      headers: clearOAuthCookie,
    });
  }

  try {
    const profile = await exchangeCodeForUser(code);
    const customer = await findOrCreateGoogleCustomer(profile);
    return createCustomerSession(customer.id, redirectTo, clearOAuthCookie);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    throw redirect(`/auth/login?error=google_failed&redirectTo=${encodeURIComponent(redirectTo)}`, {
      headers: clearOAuthCookie,
    });
  }
}
