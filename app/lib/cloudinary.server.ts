import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

export function getCloudinaryUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
    format?: string;
  } = {}
): string {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return "";

  const transforms = [
    "f_auto",
    "q_auto",
    options.width ? `w_${options.width}` : null,
    options.height ? `h_${options.height}` : null,
    options.crop ? `c_${options.crop}` : null,
  ]
    .filter(Boolean)
    .join(",");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`;
}

export function getCloudinarySrcSet(
  publicId: string,
  widths: number[] = [400, 600, 800, 1200]
): string {
  return widths
    .map((w) => `${getCloudinaryUrl(publicId, { width: w })} ${w}w`)
    .join(", ");
}

export function getCloudinaryCredentials() {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!apiSecret || !apiKey || !cloudName) {
    return null;
  }

  return { apiSecret, apiKey, cloudName };
}

export function signCloudinaryParams(paramsToSign: Record<string, unknown>) {
  const credentials = getCloudinaryCredentials();
  if (!credentials) {
    throw new Error("Cloudinary credentials not configured");
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    credentials.apiSecret
  );

  return {
    signature,
    apiKey: credentials.apiKey,
    cloudName: credentials.cloudName,
  };
}

export function getCloudinaryUploadSignature(
  folder = "shiftshappn/products"
) {
  const timestamp = Math.round(Date.now() / 1000);
  const params = { timestamp, folder };
  const signed = signCloudinaryParams(params);

  return {
    timestamp,
    folder,
    ...signed,
  };
}
