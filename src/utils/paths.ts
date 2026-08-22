export function url(path = '') {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath === '/') return base ? `${base}/` : '/';
  return `${base}${cleanPath}`;
}
