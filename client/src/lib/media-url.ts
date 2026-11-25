const MEDIA_ORIGIN = (
  process.env.NEXT_PUBLIC_MAIN_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ||
  'https://hrm-backend-m21k.onrender.com'
).replace(/\/+$/, '');

export function getMediaUrl(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${MEDIA_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}
