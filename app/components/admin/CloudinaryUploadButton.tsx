import { useEffect, useState } from "react";
import { Button } from "~/components/ui/Button";
import { cn } from "~/lib/utils";

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (
          error: Error | null,
          result: {
            event: string;
            info?: { public_id: string; secure_url: string };
          }
        ) => void
      ) => { open: () => void };
    };
  }
}

let widgetScriptPromise: Promise<void> | null = null;

function loadCloudinaryWidget(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Upload is only available in the browser."));
  }
  if (window.cloudinary) return Promise.resolve();
  if (widgetScriptPromise) return widgetScriptPromise;

  widgetScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("cloudinary-widget-script") as HTMLScriptElement | null;
    if (existing) {
      if (window.cloudinary) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load the Cloudinary upload widget.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "cloudinary-widget-script";
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      widgetScriptPromise = null;
      reject(new Error("Could not load the Cloudinary upload widget."));
    };
    document.body.appendChild(script);
  });

  return widgetScriptPromise;
}

export function CloudinaryUploadButton({
  onUpload,
  folder = "shiftshappn/products",
  label = "Upload images",
  cloudName,
  children,
  className,
}: {
  onUpload: (publicId: string, url: string) => void;
  folder?: string;
  label?: string;
  cloudName?: string | null;
  children?: React.ReactNode;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCloudinaryWidget()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function openWidget() {
    setError(null);
    setOpening(true);

    try {
      await loadCloudinaryWidget();

      const credsResponse = await fetch("/admin/api/cloudinary-sign");
      const creds = (await credsResponse.json()) as {
        apiKey?: string;
        cloudName?: string;
        error?: string;
      };

      if (!credsResponse.ok || !creds.apiKey || !creds.cloudName) {
        setError(
          creds.error ??
            "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
        );
        return;
      }

      const resolvedCloudName = cloudName || creds.cloudName;
      if (!window.cloudinary) {
        setError("Cloudinary upload widget failed to load. Refresh and try again.");
        return;
      }

      const widget = window.cloudinary.createUploadWidget(
        {
          cloudName: resolvedCloudName,
          apiKey: creds.apiKey,
          folder,
          sources: ["local", "url"],
          multiple: true,
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
          maxFileSize: 8 * 1024 * 1024,
          uploadSignature: (
            callback: (signature: string) => void,
            paramsToSign: Record<string, unknown>
          ) => {
            fetch("/admin/api/cloudinary-sign", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paramsToSign }),
            })
              .then((res) => res.json())
              .then((payload: { signature?: string; error?: string }) => {
                if (!payload.signature) {
                  throw new Error(payload.error ?? "Could not sign the upload.");
                }
                callback(payload.signature);
              })
              .catch((err: Error) => {
                setError(err.message);
              });
          },
        },
        (uploadError, result) => {
          if (uploadError) {
            setError(uploadError.message || "Upload failed. Try again.");
            return;
          }
          if (result?.event === "success" && result.info) {
            onUpload(result.info.public_id, result.info.secure_url);
          }
        }
      );
      widget.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {children ? (
        <button
          type="button"
          onClick={openWidget}
          disabled={!ready || opening}
          className="block w-full text-left disabled:cursor-wait disabled:opacity-70"
        >
          {children}
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={openWidget} disabled={!ready || opening}>
          {opening ? "Opening…" : label}
        </Button>
      )}
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
