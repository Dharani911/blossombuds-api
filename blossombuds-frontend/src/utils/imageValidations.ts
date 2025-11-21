// src/utils/imageValidation.ts

// Default sets – can be reused or overridden per use-case
export const DEFAULT_ALLOWED_IMAGE_EXT = ["jpg", "jpeg", "png", "webp"];
export const DEFAULT_BLOCKED_IMAGE_EXT = ["heic", "heif"];
export const DEFAULT_MAX_IMAGE_MB = 10;

/** Build an `accept` string for <input type="file"> from a list of extensions. */
export function buildAcceptFromExt(exts: string[]): string {
  return exts.map((ext) => `.${ext}`).join(",");
}

/** Shortcut for typical web image uploads (jpg/png/webp). */
export const WEB_IMAGE_ACCEPT = buildAcceptFromExt(DEFAULT_ALLOWED_IMAGE_EXT);

/** Detect HEIC/HEIF from filename and/or contentType. */
export function isHeicLike(filename: string | undefined, contentType: string | undefined): boolean {
  const name = (filename || "").toLowerCase();
  const type = (contentType || "").toLowerCase();

  const extMatch = name.match(/\.([a-z0-9]+)$/);
  const ext = extMatch?.[1] ?? "";

  if (ext === "heic" || ext === "heif") return true;
  if (type.includes("heic") || type.includes("heif")) return true;
  return false;
}

export type ImageValidationOptions = {
  maxMb?: number;
  allowedExt?: string[];
  blockedExt?: string[];
  label?: string; // e.g. "review image", "product image" – used in error text
};

/**
 * Generic image file validator.
 * Returns `null` if OK, or an error message string if invalid.
 */
export function validateImageFile(
  file: File | null | undefined,
  options: ImageValidationOptions = {}
): string | null {
  const {
    maxMb = DEFAULT_MAX_IMAGE_MB,
    allowedExt = DEFAULT_ALLOWED_IMAGE_EXT,
    blockedExt = DEFAULT_BLOCKED_IMAGE_EXT,
    label = "image",
  } = options;

  if (!file) return `Please select an ${label}.`;

  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  const sizeMb = file.size / (1024 * 1024);

  if (sizeMb > maxMb) {
    return `Each ${label} must be ${maxMb} MB or less.`;
  }

  const extMatch = name.match(/\.([a-z0-9]+)$/);
  const ext = extMatch?.[1] ?? "";

  // ❌ Block HEIC/HEIF (or any custom blocked ext)
  if (blockedExt.includes(ext) || type.includes("heic") || type.includes("heif")) {
    return `HEIC/HEIF files are not supported. Please upload ${label} as JPG, PNG or WebP.`;
  }

  const extAllowed = allowedExt.includes(ext);
  const looksLikeImage = type.startsWith("image/");

  if (!extAllowed || !looksLikeImage) {
    return `Only ${allowedExt.join(", ").toUpperCase()} ${label}s are allowed.`;
  }

  return null;
}
