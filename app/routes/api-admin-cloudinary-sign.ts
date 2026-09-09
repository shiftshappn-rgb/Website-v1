import type { Route } from "./+types/api-admin-cloudinary-sign";
import {
  getCloudinaryCredentials,
  signCloudinaryParams,
} from "~/lib/cloudinary.server";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const credentials = getCloudinaryCredentials();
  if (!credentials) {
    return Response.json(
      { error: "Cloudinary is not configured." },
      { status: 503 }
    );
  }

  return Response.json({
    apiKey: credentials.apiKey,
    cloudName: credentials.cloudName,
  });
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const credentials = getCloudinaryCredentials();
  if (!credentials) {
    return Response.json(
      { error: "Cloudinary is not configured." },
      { status: 503 }
    );
  }

  let paramsToSign: Record<string, unknown>;
  try {
    const body = (await request.json()) as {
      paramsToSign?: Record<string, unknown>;
    };
    paramsToSign = body.paramsToSign ?? body;
  } catch {
    return Response.json({ error: "Invalid signature payload." }, { status: 400 });
  }

  if (!paramsToSign || typeof paramsToSign !== "object" || Array.isArray(paramsToSign)) {
    return Response.json({ error: "Invalid signature payload." }, { status: 400 });
  }

  const { signature } = signCloudinaryParams(paramsToSign);
  return Response.json({ signature });
}
