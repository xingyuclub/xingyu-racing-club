import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeNewsBodyHtml } from './newsRichText.js';

describe('sanitizeNewsBodyHtml', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it('keeps supported formatting and derives readable plain text', () => {
    const result = sanitizeNewsBodyHtml(
      '<h2 style="text-align:center">规则</h2><p><strong style="color:#ff0000;font-family:SimHei;font-size:20px">第一条</strong></p><ul><li>保持活跃</li></ul>',
    );

    expect(result.html).toContain('<h2 style="text-align:center">规则</h2>');
    expect(result.html).toContain('color:#ff0000');
    expect(result.html).toContain('<ul><li>保持活跃</li></ul>');
    expect(result.text).toMatch(/规则[\s\S]*第一条[\s\S]*保持活跃/);
  });

  it('removes executable markup and unsafe URLs', () => {
    const result = sanitizeNewsBodyHtml(
      '<script>alert(1)</script><p onclick="alert(2)">正文</p><a href="javascript:alert(3)">链接</a><img src="data:image/png;base64,abc" onerror="alert(4)">',
    );

    expect(result.html).toBe('<p>正文</p><a>链接</a>');
    expect(result.html).not.toMatch(/script|onclick|javascript:|data:|onerror/);
  });

  it('allows project images and rejects remote image hotlinks', () => {
    const result = sanitizeNewsBodyHtml(
      '<img src="/uploads/a.jpg" alt="A"><img src="/images/album/b.jpg" alt="B"><img src="https://example.com/c.jpg" alt="C"><img src="/uploads/../private.jpg" alt="D"><img src="/images/%2e%2e/private.jpg" alt="E">',
    );

    expect(result.html).toContain('/uploads/a.jpg');
    expect(result.html).toContain('/images/album/b.jpg');
    expect(result.html).not.toContain('example.com');
    expect(result.html).not.toContain('private.jpg');
  });

  it('allows images from the configured COS CDN origin only', () => {
    vi.stubEnv('COS_CDN_BASE_URL', 'https://media.example.test');
    const result = sanitizeNewsBodyHtml(
      '<img src="https://media.example.test/originals/a.jpg" alt="A"><img src="https://evil.example.test/a.jpg" alt="B"><img src="https://media.example.test/../private.jpg" alt="C">',
    );

    expect(result.html).toContain('https://media.example.test/originals/a.jpg');
    expect(result.html).not.toContain('evil.example.test');
    expect(result.html).not.toContain('private.jpg');
  });

  it('allows safe site links and secures external links', () => {
    const result = sanitizeNewsBodyHtml(
      '<a href="/album" target="_blank" rel="opener">相册</a><a href="mailto:team@example.com">邮件</a><a href="https://example.com/news">官网</a><a href=" https://example.com/space " target="_blank" rel="opener">空白链接</a><a href="https:\\evil.example/x" target="_blank" rel="opener">含糊链接</a>',
    );

    expect(result.html).toContain('<a href="/album">相册</a>');
    expect(result.html).toContain('href="mailto:team@example.com"');
    expect(result.html).toContain('href="https://example.com/space" target="_blank" rel="noopener noreferrer"');
    expect(result.html).toContain('target="_blank"');
    expect(result.html).toContain('rel="noopener noreferrer"');
    expect(result.html).toContain('<a>含糊链接</a>');
    expect(result.html).not.toContain('rel="opener"');
  });

  it('removes unsupported styles while keeping toolbar styles', () => {
    const result = sanitizeNewsBodyHtml(
      '<p style="position:fixed;text-align:right;font-weight:700;background:url(javascript:bad)">正文</p><span style="font-family:Comic Sans MS;font-size:99px;color:expression(bad)">格式</span>',
    );

    expect(result.html).toContain('text-align:right');
    expect(result.html).toContain('font-weight:700');
    expect(result.html).not.toMatch(/position|background|Comic|99px|expression/);
  });
});
