const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  ico: "image/x-icon",
};

const MIME_TO_EXTENSION: Record<string, string> = Object.entries(EXTENSION_TO_MIME).reduce<Record<string, string>>((acc, [ext, mime]) => {
  if (!acc[mime]) acc[mime] = ext;
  return acc;
}, {});

const ACCEPTED_IMAGE_EXTENSIONS = Object.keys(EXTENSION_TO_MIME);
const ACCEPTED_IMAGE_MIMES = new Set(Object.values(EXTENSION_TO_MIME));

function normalizeExtension(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getImageExtensionFromName(name: string) {
  const raw = String(name || "").trim();
  if (!raw.includes(".")) return "";
  return normalizeExtension(raw.split(".").pop() || "");
}

export function resolveImageMimeType(file: Pick<File, "name" | "type">) {
  const fileType = String(file.type || "").trim().toLowerCase();
  if (fileType.startsWith("image/")) {
    if (ACCEPTED_IMAGE_MIMES.has(fileType)) return fileType;
    if (fileType === "image/jpg") return "image/jpeg";
    return fileType;
  }

  const extension = getImageExtensionFromName(file.name);
  return EXTENSION_TO_MIME[extension] || "";
}

export function resolveImageExtension(file: Pick<File, "name" | "type">) {
  const fromMime = MIME_TO_EXTENSION[resolveImageMimeType(file)];
  if (fromMime) return fromMime;
  const fromName = getImageExtensionFromName(file.name);
  return fromName || "jpg";
}

export function isAcceptedImageFile(file: Pick<File, "name" | "type">) {
  return Boolean(resolveImageMimeType(file));
}

export function getAcceptedImageUploadHint() {
  return "JPG, PNG, WebP, AVIF, GIF, BMP, SVG, TIFF, HEIC, or HEIF";
}

export function getAcceptedImageUploadValue() {
  return `${ACCEPTED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",")},image/*`;
}

