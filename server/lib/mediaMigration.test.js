import { describe, expect, it } from 'vitest';
import {
  assertScoreDataUnchanged,
  collectUploadPaths,
  rewriteUploadPaths,
} from './mediaMigration.js';

describe('media migration helpers', () => {
  it('collects unique upload paths from fields and rich text', () => {
    expect(collectUploadPaths({
      image: '/uploads/a.jpg',
      bodyHtml: '<p><img src="/uploads/b--新闻图.png"></p><img src="/uploads/a.jpg">',
    })).toEqual(['/uploads/a.jpg', '/uploads/b--新闻图.png']);
  });

  it('rewrites upload paths without changing unrelated text', () => {
    const input = {
      image: '/uploads/a.jpg',
      bodyHtml: '<img src="/uploads/b.png"><a href="/news">资讯</a>',
    };
    const replacements = new Map([
      ['/uploads/a.jpg', 'https://media.example.test/variants/a.webp'],
      ['/uploads/b.png', 'https://media.example.test/variants/b.webp'],
    ]);

    expect(rewriteUploadPaths(input, replacements)).toEqual({
      image: 'https://media.example.test/variants/a.webp',
      bodyHtml: '<img src="https://media.example.test/variants/b.webp"><a href="/news">资讯</a>',
    });
  });

  it('rejects any migration that changes score data', () => {
    const before = { scoreMembers: [{ id: '1' }], dailyScores: [], weekendScores: [] };
    expect(() => assertScoreDataUnchanged(before, structuredClone(before))).not.toThrow();
    expect(() => assertScoreDataUnchanged(before, {
      ...structuredClone(before),
      dailyScores: [{ date: '2026-08-07', rows: [] }],
    })).toThrow(/dailyScores/);
  });
});
