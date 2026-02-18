export function detectOpenCartFromUrlAndHtml(options: {
  url: string;
  html?: string | null;
}): boolean {
  const url = options.url || "";
  const html = options.html || "";

  // URL patterns commonly seen on OpenCart stores.
  if (/index\.php\?route=/i.test(url)) return true;
  if (/[?&]route=product\/product/i.test(url)) return true;

  // Meta generator tag (best signal when present).
  if (/<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*opencart/i.test(html)) {
    return true;
  }

  // Common structural hints.
  if (/id=["']product-product["']/i.test(html)) return true;
  if (/catalog\/view\/javascript\/common\.js/i.test(html)) return true;

  return false;
}

