import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createSeedConfig } from '../data/siteConfig.js';
import AdminApp from './AdminApp.jsx';
import { ConfigEditor } from './ConfigEditor.jsx';
import { UploadField } from './UploadField.jsx';

afterEach(() => vi.unstubAllGlobals());

it('logs in, edits public content, uploads a cover, and saves the draft', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 204 })
    .mockResolvedValueOnce({ ok: true, json: async () => config })
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ name: 'abc--hero.mp4', path: '/uploads/abc--hero.mp4', type: 'video', size: 5 }) })
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ name: 'def--fallback.png', path: '/uploads/def--fallback.png', type: 'image', size: 5 }) })
    .mockResolvedValueOnce({ ok: true, status: 204 }));

  render(<AdminApp />);
  await user.type(screen.getByLabelText('账号'), 'admin');
  await user.type(screen.getByLabelText('密码'), 'test-password');
  await user.click(screen.getByRole('button', { name: '登录' }));
  const motto = await screen.findByLabelText('车队口号');
  expect(screen.getByLabelText('第 1 句')).toHaveValue(config.team.heroLines[0]);
  expect(screen.getByLabelText('第 2 句')).toHaveValue(config.team.heroLines[1]);
  expect(screen.getByRole('heading', { name: '星屿积分榜' })).toBeInTheDocument();
  expect(screen.getByLabelText('导入积分 Excel')).toBeInTheDocument();
  expect(screen.queryByLabelText('期初积分')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('胜场')).not.toBeInTheDocument();
  await user.clear(motto);
  await user.type(motto, '新的口号');
  const firstRole = screen.getAllByLabelText('角色')[0];
  await user.clear(firstRole);
  await user.type(firstRole, '队长');
  const rosterSection = screen.getByRole('heading', { name: '成员管理' }).closest('section');
  await user.click(within(rosterSection).getByRole('button', { name: '新增' }));
  expect(within(rosterSection).getAllByLabelText('ID').at(-1)).toHaveValue('1');
  await user.upload(screen.getByLabelText('首页主媒体上传'), new File(['video'], 'hero.mp4', { type: 'video/mp4' }));
  await user.upload(screen.getByLabelText('视频失败备用图上传'), new File(['image'], 'fallback.png', { type: 'image/png' }));
  await user.click(screen.getByRole('button', { name: '保存全部配置' }));

  expect(fetch).toHaveBeenLastCalledWith('/api/admin/config', expect.objectContaining({ method: 'PUT' }));
    const savedConfig = JSON.parse(fetch.mock.calls.at(-1)[1].body);
    expect(savedConfig.roster[0].role).toBe('队长');
    expect(savedConfig.team.heroMedia).toEqual({ src: '/uploads/abc--hero.mp4', type: 'video' });
    expect(savedConfig.team.heroFallbackImage).toBe('/uploads/def--fallback.png');
    expect(screen.getByText('hero.mp4', { selector: 'code' })).toBeInTheDocument();
    expect(screen.getByText('fallback.png', { selector: 'code' })).toBeInTheDocument();
    expect(screen.queryByLabelText('首屏图片上传')).not.toBeInTheDocument();
});

it.each([
  ['/uploads/abc--青山头像.jpg', '青山头像.jpg'],
  ['/uploads/legacy-avatar.jpg', 'legacy-avatar.jpg'],
])('shows the display filename for %s', (value, expected) => {
  render(<UploadField label="头像上传" value={value} onChange={vi.fn()} />);

  expect(screen.getByText(expected, { selector: 'code' })).toBeInTheDocument();
  expect(screen.queryByText(value, { selector: 'code' })).not.toBeInTheDocument();
});

it('lets each member card collapse and expand without losing its values', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  const member = config.roster[0];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);

  const collapseButton = screen.getByRole('button', { name: `收起 ${member.name}` });
  const memberCard = collapseButton.closest('.array-item');
  expect(within(memberCard).getByLabelText('名称')).toHaveValue(member.name);

  await user.click(collapseButton);

  expect(within(memberCard).queryByLabelText('名称')).not.toBeInTheDocument();
  expect(within(memberCard).getByText(`${member.name} · ID ${member.id}`)).toBeInTheDocument();

  await user.click(within(memberCard).getByRole('button', { name: `展开 ${member.name}` }));
  expect(within(memberCard).getByLabelText('名称')).toHaveValue(member.name);
});

it('collapses existing news into title category and date summaries', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  const news = config.news[0];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);

  const expandButton = screen.getByRole('button', { name: `展开 ${news.title}` });
  const card = expandButton.closest('.array-item');
  expect(within(card).getByText(`${news.title} · ${news.category} · ${news.date}`)).toBeInTheDocument();
  expect(within(card).queryByLabelText('标题')).not.toBeInTheDocument();

  await user.click(expandButton);

  expect(within(card).getByLabelText('标题')).toHaveValue(news.title);
  expect(within(card).getByRole('textbox', { name: '新闻正文' })).toHaveTextContent(news.body);
});

it('opens newly added news with separate cover and article image controls', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);
  const section = screen.getByRole('heading', { name: '新闻管理' }).closest('section');
  await user.click(within(section).getByRole('button', { name: '新增' }));

  expect(within(section).getByLabelText('首页封面图上传')).toHaveAttribute('accept', 'image/*');
  expect(within(section).getByLabelText('插入正文图片')).toHaveAttribute('accept', 'image/*');
  expect(within(section).getByRole('textbox', { name: '新闻正文' })).toBeInTheDocument();
  expect(within(section).getByRole('button', { name: '收起 未填写标题' })).toBeInTheDocument();
});

it('keeps a news card expanded while its editable ID changes', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);
  const section = screen.getByRole('heading', { name: '新闻管理' }).closest('section');
  await user.click(within(section).getByRole('button', { name: `展开 ${config.news[0].title}` }));
  const idInput = within(section).getByLabelText('ID');

  await user.clear(idInput);
  await user.type(idInput, 'updated-news-id');

  expect(within(section).getByLabelText('ID')).toHaveValue('updated-news-id');
  expect(within(section).getByLabelText('标题')).toHaveValue(config.news[0].title);
  expect(within(section).getByRole('button', { name: `收起 ${config.news[0].title}` })).toBeInTheDocument();
});
