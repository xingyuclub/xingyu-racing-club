import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createSeedConfig } from '../data/siteConfig.js';
import AdminApp from './AdminApp.jsx';
import { ConfigEditor } from './ConfigEditor.jsx';
import { UploadField } from './UploadField.jsx';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('starts every top-level admin section collapsed and expands them independently', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

  render(<ConfigEditor initialConfig={createSeedConfig()} onAuthError={() => false} />);

  expect(screen.getAllByRole('button', { name: /^展开/ })).toHaveLength(7);
  expect(screen.queryByLabelText('名称')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('个性签名')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '展开 成员管理' }));

  expect(screen.getAllByLabelText('个性签名')[0]).toHaveValue('');
  expect(screen.getByRole('button', { name: '收起 成员管理' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: '展开 新闻管理' })).toHaveAttribute('aria-expanded', 'false');
});

it('logs in, edits public content, uploads a cover, and saves the draft', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: '请先登录' }) })
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
  await user.click(await screen.findByRole('button', { name: '展开 基础信息' }));
  await user.click(screen.getByRole('button', { name: '展开 成员管理' }));
  await user.click(screen.getByRole('button', { name: '展开 星屿积分榜' }));
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
  await user.type(screen.getAllByLabelText('个性签名')[0], '一路向星光');
  const rosterSection = screen.getByRole('heading', { name: '成员管理' }).closest('section');
  await user.click(within(rosterSection).getByRole('button', { name: '新增' }));
  expect(within(rosterSection).getAllByLabelText('ID').at(-1)).toHaveValue('1');
  await user.upload(screen.getByLabelText('首页主媒体上传'), new File(['video'], 'hero.mp4', { type: 'video/mp4' }));
  await user.upload(screen.getByLabelText('视频失败备用图上传'), new File(['image'], 'fallback.png', { type: 'image/png' }));
  await user.click(screen.getByRole('button', { name: '保存全部配置' }));

  expect(fetch).toHaveBeenLastCalledWith('/api/admin/config', expect.objectContaining({ method: 'PUT' }));
    const savedConfig = JSON.parse(fetch.mock.calls.at(-1)[1].body);
    expect(savedConfig.roster[0].role).toBe('队长');
    expect(savedConfig.roster[0].signature).toBe('一路向星光');
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

  await user.click(screen.getByRole('button', { name: '展开 成员管理' }));

  const collapseButton = screen.getByRole('button', { name: `收起 ${member.name}` });
  const memberCard = collapseButton.closest('.array-item');
  expect(within(memberCard).getByLabelText('名称')).toHaveValue(member.name);

  await user.click(collapseButton);

  expect(within(memberCard).queryByLabelText('名称')).not.toBeInTheDocument();
  expect(within(memberCard).getByText(`${member.name} · ID ${member.id}`)).toBeInTheDocument();

  await user.click(within(memberCard).getByRole('button', { name: `展开 ${member.name}` }));
  expect(within(memberCard).getByLabelText('名称')).toHaveValue(member.name);
});

it('adds an editable signature field to legacy members without rebuilding them', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  const legacyMember = config.roster[0];
  delete legacyMember.signature;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);
  await user.click(screen.getByRole('button', { name: '展开 成员管理' }));

  const memberCard = screen.getByRole('button', { name: `收起 ${legacyMember.name}` }).closest('.array-item');
  const signature = within(memberCard).getByLabelText('个性签名');
  expect(signature).toHaveValue('');

  await user.type(signature, '一起冲向终点');
  await user.click(screen.getByRole('button', { name: '保存全部配置' }));

  const savedConfig = JSON.parse(fetch.mock.calls.at(-1)[1].body);
  expect(savedConfig.roster[0]).toEqual(expect.objectContaining({
    id: legacyMember.id,
    avatar: legacyMember.avatar,
    videoUrl: legacyMember.videoUrl,
    signature: '一起冲向终点',
  }));
});

it('collapses existing news into title category and date summaries', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  const news = config.news[0];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);

  await user.click(screen.getByRole('button', { name: '展开 新闻管理' }));

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
  await user.click(screen.getByRole('button', { name: '展开 新闻管理' }));
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
  await user.click(screen.getByRole('button', { name: '展开 新闻管理' }));
  const section = screen.getByRole('heading', { name: '新闻管理' }).closest('section');
  await user.click(within(section).getByRole('button', { name: `展开 ${config.news[0].title}` }));
  const idInput = within(section).getByLabelText('ID');

  await user.clear(idInput);
  await user.type(idInput, 'updated-news-id');

  expect(within(section).getByLabelText('ID')).toHaveValue('updated-news-id');
  expect(within(section).getByLabelText('标题')).toHaveValue(config.news[0].title);
  expect(within(section).getByRole('button', { name: `收起 ${config.news[0].title}` })).toBeInTheDocument();
});

it('skips the login form when the session is still valid', async () => {
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => config })
    .mockResolvedValue({ ok: true, json: async () => [] }));

  render(<AdminApp />);

  expect(await screen.findByRole('button', { name: '展开 基础信息' })).toBeInTheDocument();
  expect(screen.queryByLabelText('账号')).not.toBeInTheDocument();
});

it('remembers credentials and auto-logs-in on the next visit', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  const sessionCheck = { ok: false, status: 401, json: async () => ({ error: '请先登录' }) };
  const loginOk = { ok: true, status: 204 };
  const configOk = { ok: true, json: async () => config };

  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(sessionCheck)
    .mockResolvedValueOnce(loginOk)
    .mockResolvedValueOnce(configOk)
    .mockResolvedValue({ ok: true, json: async () => [] }));

  const first = render(<AdminApp />);
  await user.type(screen.getByLabelText('账号'), 'admin');
  await user.type(screen.getByLabelText('密码'), 'test-password');
  await user.click(screen.getByRole('checkbox', { name: '记住密码' }));
  await user.click(screen.getByRole('button', { name: '登录' }));

  expect(await screen.findByRole('button', { name: '展开 基础信息' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('xingyu-admin-remember'))).toEqual({
    username: 'admin',
    password: 'test-password',
  });
  first.unmount();

  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(sessionCheck)
    .mockResolvedValueOnce(loginOk)
    .mockResolvedValueOnce(configOk)
    .mockResolvedValue({ ok: true, json: async () => [] }));

  render(<AdminApp />);
  expect(await screen.findByRole('button', { name: '展开 基础信息' })).toBeInTheDocument();
});

it('clears remembered credentials when the checkbox is unchecked', async () => {
  localStorage.setItem('xingyu-admin-remember', JSON.stringify({ username: 'admin', password: 'old' }));
  const user = userEvent.setup();
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: '请先登录' }) })
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: '账号或密码错误' }) })
    .mockResolvedValueOnce({ ok: true, status: 204 })
    .mockResolvedValueOnce({ ok: true, json: async () => config })
    .mockResolvedValue({ ok: true, json: async () => [] }));

  render(<AdminApp />);

  expect(await screen.findByRole('checkbox', { name: '记住密码' })).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: '记住密码' }));
  await user.click(screen.getByRole('button', { name: '登录' }));

  expect(await screen.findByRole('button', { name: '展开 基础信息' })).toBeInTheDocument();
  expect(localStorage.getItem('xingyu-admin-remember')).toBeNull();
});

