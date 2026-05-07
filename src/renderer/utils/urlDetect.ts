const IMAGE_URL_RE = /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/i;
const URL_RE = /^https?:\/\/.+/i;

export function isImageUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.includes('\n')) return false;
  return IMAGE_URL_RE.test(trimmed);
}

export function isUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.includes('\n')) return false;
  return URL_RE.test(trimmed);
}
