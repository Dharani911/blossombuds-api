// src/utils/imageValidation.ts

// Default sets – can be reused or overridden per use-case
export const DEFAULT_ALLOWED_IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
export const DEFAULT_BLOCKED_IMAGE_EXT: string[] = [];
export const DEFAULT_MAX_IMAGE_MB = 10;

/** Build an `accept` string for <input type="file"> from a list of extensions. */
export function buildAcceptFromExt(exts: string[]): string {
  return exts.map((ext) => `.${ext}`).join(",");
}

/** Shortcut for typical web image uploads (jpg/png/webp/heic).
 *  Includes both extensions AND MIME types so iOS Safari Camera Roll honours it. */
export const WEB_IMAGE_ACCEPT =
  buildAcceptFromExt(DEFAULT_ALLOWED_IMAGE_EXT) +
  ",image/jpeg,image/png,image/webp,image/heic,image/heif";

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

  if (file.size === 0) return `The selected ${label} appears to be empty or corrupt.`;

  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  const sizeMb = file.size / (1024 * 1024);

  if (sizeMb > maxMb) {
    return `Each ${label} must be ${maxMb} MB or less.`;
  }

  const extMatch = name.match(/\.([a-z0-9]+)$/);
  const ext = extMatch?.[1] ?? "";

  if (blockedExt.includes(ext)) {
    return `${ext.toUpperCase()} files are not supported. Please upload ${label} as ${allowedExt.slice(0, 3).join(", ").toUpperCase()}.`;
  }

  // If there's no file extension (e.g. iOS share sheet sends "image" with image/heic MIME),
  // fall back to MIME-type detection before rejecting.
  if (!ext || !allowedExt.includes(ext)) {
    if (isHeicLike(file.name, file.type)) return null;
    if (type.startsWith("image/") && allowedExt.some((e) => type.includes(e))) return null;
    if (ext) {
      return `Only ${allowedExt.join(", ").toUpperCase()} ${label}s are allowed.`;
    }
    return `Only ${allowedExt.join(", ").toUpperCase()} ${label}s are allowed.`;
  }

  // HEIC files may have an empty or non-standard MIME type on some browsers/OS combinations
  if (type && !type.startsWith("image/")) {
    return `Only image files are supported.`;
  }

  return null;
}
