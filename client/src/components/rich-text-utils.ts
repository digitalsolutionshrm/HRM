const allowedTags = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'DIV', 'EM', 'H1', 'H2', 'H3',
  'H4', 'H5', 'H6', 'HR', 'I', 'LI', 'OL', 'P', 'PRE', 'S', 'SPAN', 'STRONG',
  'U', 'UL', 'FONT',
]);

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function sanitizeRichTextHtml(value: string): string {
  if (typeof window === 'undefined') return '';
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? '');
    if (!(node instanceof HTMLElement)) return '';
    const children = Array.from(node.childNodes).map(clean).join('');
    if (!allowedTags.has(node.tagName)) return children;
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      try {
        const url = new URL(href, window.location.origin);
        if (!['http:', 'https:'].includes(url.protocol)) return children;
        return `<a href="${url.href}" target="_blank" rel="noopener noreferrer">${children}</a>`;
      } catch {
        return children;
      }
    }
    if (node.tagName === 'FONT' || node.tagName === 'SPAN') {
      const color = node.style.color || node.getAttribute('color') || '';
      if (/^(#[\da-f]{3,8}|rgb\([\d\s,%]+\)|[a-z]+)$/i.test(color)) {
        return `<span style="color:${color}">${children}</span>`;
      }
      return children;
    }
    return `<${node.tagName.toLowerCase()}>${children}</${node.tagName.toLowerCase()}>`;
  };
  return Array.from(parsed.body.childNodes).map(clean).join('');
}

export function hasRichTextMarkup(value: string): boolean {
  return /<(?:a|b|blockquote|br|code|del|div|em|h[1-6]|hr|i|li|ol|p|pre|s|span|strong|u|ul|font)(?:\s|>)/i.test(value);
}
