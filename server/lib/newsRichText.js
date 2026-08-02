import sanitizeHtml from 'sanitize-html';
import { convert } from 'html-to-text';

const PROJECT_IMAGE_PATTERN = /^\/(?:uploads|images)\/.+$/;

function isProjectImagePath(value) {
  try {
    const decoded = decodeURIComponent(value || '');
    return PROJECT_IMAGE_PATTERN.test(decoded)
      && !/[?#\\]/.test(decoded)
      && !decoded.split('/').some((segment) => segment === '.' || segment === '..');
  } catch {
    return false;
  }
}

function sanitizeLinkAttributes(attributes) {
  const href = String(attributes.href || '').trim();
  if (!href || /[\\\u0000-\u001f\u007f]/.test(href)) return {};
  if (/^https?:\/\/[^\s]+$/i.test(href)) {
    return { href, target: '_blank', rel: 'noopener noreferrer' };
  }
  if (/^mailto:[^\s]+$/i.test(href) || /^(?:\/(?!\/)|#|\?)/.test(href)) {
    return { href };
  }
  return {};
}

const SANITIZE_OPTIONS = {
  allowedTags: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'u', 's', 'span', 'a', 'img', 'br'],
  allowedAttributes: {
    '*': ['style'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{6}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i],
      'font-family': [/^(?:Microsoft YaHei|SimHei|SimSun|KaiTi|sans-serif)$/],
      'font-size': [/^(?:14|16|18|20|24|28)px$/],
      'font-weight': [/^(?:400|700)$/],
      'text-align': [/^(?:left|center|right)$/],
    },
  },
  transformTags: {
    a: (tagName, attributes) => ({ tagName, attribs: sanitizeLinkAttributes(attributes) }),
  },
  exclusiveFilter: (frame) => (
    frame.tag === 'img' && !isProjectImagePath(frame.attribs.src)
  ),
};

export function sanitizeNewsBodyHtml(html) {
  if (typeof html !== 'string') return { html: '', text: '' };

  const cleanHtml = sanitizeHtml(html, SANITIZE_OPTIONS);
  const text = convert(cleanHtml, {
    wordwrap: false,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { ignoreHref: true } },
    ],
  })
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { html: cleanHtml, text };
}
