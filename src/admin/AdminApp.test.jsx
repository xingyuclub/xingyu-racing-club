import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createSeedConfig } from '../data/siteConfig.js';
import AdminApp from './AdminApp.jsx';
import { applyUploadResult, ConfigEditor } from './ConfigEditor.jsx';
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

it('accepts audio files for the music source field', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

  render(<ConfigEditor initialConfig={createSeedConfig()} onAuthError={() => false} />);
  await user.click(screen.getByRole('button', { name: '展开 基础信息' }));

  expect(screen.getByLabelText('素材路径上传')).toHaveAttribute('accept', 'audio/*');
  expect(screen.getByLabelText('封面上传')).toHaveAttribute('accept', 'image/*');
});

it('logs in, edits public content, uploads a cover, and saves the draft', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: '请先登录' }) })
    .mockResolvedValueOnce({ ok: true, status: 204 })
    .mockResolvedValueOnce({ ok: true, json: async () => config })
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({
      name: 'abc--hero.mp4',
      path: '/videos/abc--hero--720p.mp4',
      originalPath: '/originals/abc--hero.mp4',
      posterPath: '/posters/abc--hero--poster.webp',
      type: 'video',
      size: 5,
      metadata: { width: 1920, height: 1080, duration: 10 },
    }) })
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ name: 'def--fallback.png', path: '/uploads/def--fallback.png', type: 'image', size: 5 }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => config })
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

  const saveCall = fetch.mock.calls.find(([path, options]) =>
    path === '/api/admin/config' && options?.method === 'PUT');
    expect(saveCall).toBeDefined();
    const savedConfig = JSON.parse(saveCall[1].body);
    expect(savedConfig.roster[0].role).toBe('队长');
    expect(savedConfig.roster[0].signature).toBe('一路向星光');
    expect(savedConfig.team.heroMedia).toEqual({
      src: '/videos/abc--hero--720p.mp4',
      type: 'video',
      originalSrc: '/originals/abc--hero.mp4',
      originalSize: 5,
      posterSrc: '/posters/abc--hero--poster.webp',
      width: 1920,
      height: 1080,
      duration: 10,
    });
    expect(savedConfig.team.heroFallbackImage).toBe('/uploads/def--fallback.png');
    expect(screen.getByText('hero.mp4', { selector: 'code' })).toBeInTheDocument();
    expect(screen.getByText('fallback.png', { selector: 'code' })).toBeInTheDocument();
    expect(screen.queryByLabelText('首屏图片上传')).not.toBeInTheDocument();
}, 10_000);

it.each([
  ['/uploads/abc--青山头像.jpg', '青山头像.jpg'],
  ['/uploads/legacy-avatar.jpg', 'legacy-avatar.jpg'],
])('shows the display filename for %s', (value, expected) => {
  render(<UploadField label="头像上传" value={value} onChange={vi.fn()} />);

  expect(screen.getByText(expected, { selector: 'code' })).toBeInTheDocument();
  expect(screen.queryByText(value, { selector: 'code' })).not.toBeInTheDocument();
});

it('uploads the same filename again and applies the latest result', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({
      path: '/videos/first--720p.mp4',
      type: 'video',
    }) })
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({
      path: '/videos/second--720p.mp4',
      type: 'video',
    }) }));

  render(<UploadField
    label="视频地址上传"
    value="/videos/old--720p.mp4"
    onChange={onChange}
    allowedTypes={['video']}
  />);

  const input = screen.getByLabelText('视频地址上传');
  await user.upload(input, new File(['first'], '十二.mp4', { type: 'video/mp4' }));
  await user.upload(input, new File(['second'], '十二.mp4', { type: 'video/mp4' }));

  expect(fetch).toHaveBeenCalledTimes(2);
  expect(onChange).toHaveBeenLastCalledWith(
    '/videos/second--720p.mp4',
    expect.objectContaining({ path: '/videos/second--720p.mp4' }),
  );
});

it('keeps saving disabled until an upload finishes', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  let finishUpload;
  const uploadResponse = new Promise((resolve) => { finishUpload = resolve; });
  vi.stubGlobal('fetch', vi.fn((path) => {
    if (path === '/api/admin/uploads') {
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    }
    if (path === '/api/admin/upload') return uploadResponse;
    return Promise.resolve({ ok: true, status: 200, json: async () => config });
  }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);
  await user.click(screen.getByRole('button', { name: '展开 成员管理' }));
  const input = screen.getAllByLabelText('视频地址上传')[0];
  const upload = user.upload(input, new File(['video'], '十二.mp4', { type: 'video/mp4' }));

  expect(await screen.findByText('素材上传中，请稍候')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存全部配置' })).toBeDisabled();

  finishUpload({
    ok: true,
    status: 201,
    json: async () => ({ path: '/videos/new--720p.mp4', type: 'video' }),
  });
  await upload;

  expect(screen.queryByText('素材上传中，请稍候')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存全部配置' })).toBeEnabled();
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
  vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
    if (path === '/api/admin/uploads') {
      return { ok: true, status: 200, json: async () => [] };
    }
    if (path === '/api/admin/config' && options.method !== 'PUT') {
      return { ok: true, status: 200, json: async () => config };
    }
    return { ok: true, status: 204 };
  }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);
  await user.click(screen.getByRole('button', { name: '展开 成员管理' }));

  const memberCard = screen.getByRole('button', { name: `收起 ${legacyMember.name}` }).closest('.array-item');
  const signature = within(memberCard).getByLabelText('个性签名');
  expect(signature).toHaveValue('');

  await user.type(signature, '一起冲向终点');
  await user.click(screen.getByRole('button', { name: '保存全部配置' }));

  const saveCall = fetch.mock.calls.find(([path, options]) =>
    path === '/api/admin/config' && options?.method === 'PUT');
  const savedConfig = JSON.parse(saveCall[1].body);
  expect(savedConfig.roster[0]).toEqual(expect.objectContaining({
    id: legacyMember.id,
    avatar: legacyMember.avatar,
    videoUrl: legacyMember.videoUrl,
    signature: '一起冲向终点',
  }));
});

it('stores lightweight and original media paths without exposing them as manual fields', () => {
  const config = createSeedConfig();
  const withAvatar = applyUploadResult(config, ['roster', 0, 'avatar'], {
    path: '/variants/avatar--display.webp',
    originalPath: '/originals/avatar.jpg',
    size: 4_000_000,
    type: 'image',
    variants: {
      thumb: '/variants/avatar--thumb.webp',
      card: '/variants/avatar--card.webp',
      display: '/variants/avatar--display.webp',
    },
  });
  const withVideo = applyUploadResult(withAvatar, ['roster', 0, 'videoUrl'], {
    path: '/videos/member--720p.mp4',
    originalPath: '/originals/member.mp4',
    posterPath: '/posters/member--poster.webp',
    size: 120_000_000,
    type: 'video',
    metadata: { width: 1920, height: 1080, duration: 48 },
  });

  expect(withVideo.roster[0]).toMatchObject({
    avatar: '/variants/avatar--card.webp',
    avatarThumb: '/variants/avatar--thumb.webp',
    avatarCard: '/variants/avatar--card.webp',
    avatarOriginalSrc: '/originals/avatar.jpg',
    avatarOriginalSize: 4_000_000,
    videoUrl: '/videos/member--720p.mp4',
    videoPosterSrc: '/posters/member--poster.webp',
    videoOriginalUrl: '/originals/member.mp4',
    videoOriginalSize: 120_000_000,
    videoWidth: 1920,
    videoHeight: 1080,
    videoDuration: 48,
  });
});
it('edits the permanent score identity binding on a roster member', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
    if (path === '/api/admin/uploads') {
      return { ok: true, status: 200, json: async () => [] };
    }
    if (path === '/api/admin/config' && options.method !== 'PUT') {
      return { ok: true, status: 200, json: async () => config };
    }
    return { ok: true, status: 204 };
  }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);
  await user.click(screen.getByRole('button', { name: '展开 成员管理' }));

  const memberCard = screen.getByRole('button', { name: `收起 ${config.roster[0].name}` })
    .closest('.array-item');
  const binding = within(memberCard).getByLabelText('积分人物');
  expect(binding).toHaveValue(config.roster[0].scoreMemberId);
  expect(within(memberCard).getByRole('option', { name: config.scoreMembers[1].name }))
    .toBeDisabled();

  await user.selectOptions(binding, '');
  await user.click(screen.getByRole('button', { name: '保存全部配置' }));

  const saveCall = fetch.mock.calls.find(([path, options]) =>
    path === '/api/admin/config' && options?.method === 'PUT');
  const savedConfig = JSON.parse(saveCall[1].body);
  expect(savedConfig.roster[0].scoreMemberId).toBe('');
});

it('restores referenced score identities from the latest config before saving a stale draft', async () => {
  const user = userEvent.setup();
  const latestConfig = createSeedConfig();
  const staleConfig = structuredClone(latestConfig);
  staleConfig.scoreMembers = staleConfig.scoreMembers.slice(0, 2);
  vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
    if (path === '/api/admin/uploads') {
      return { ok: true, status: 200, json: async () => [] };
    }
    if (path === '/api/admin/config' && options.method !== 'PUT') {
      return { ok: true, status: 200, json: async () => latestConfig };
    }
    return { ok: true, status: 204 };
  }));

  render(<ConfigEditor initialConfig={staleConfig} onAuthError={() => false} />);
  await user.click(screen.getByRole('button', { name: '保存全部配置' }));

  const saveCall = fetch.mock.calls.find(([path, options]) =>
    path === '/api/admin/config' && options?.method === 'PUT');
  const savedConfig = JSON.parse(saveCall[1].body);
  expect(savedConfig.scoreMembers.map((member) => member.id)).toEqual(
    expect.arrayContaining(latestConfig.scoreMembers.map((member) => member.id)),
  );
});

it('keeps an explicitly deleted score identity removed when saving', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  const removedId = config.scoreMembers[0].id;
  config.roster[0].scoreMemberId = removedId;
  config.dailyScores = [{
    date: '2026-08-04',
    rows: [{ id: removedId, teamRace: [1, null, null], openRace: [null, null, null] }],
  }];
  config.weekendScores = [{ date: '2026-08-02', rows: [{ id: removedId, points: 10 }] }];
  vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
    if (path === '/api/admin/uploads') {
      return { ok: true, status: 200, json: async () => [] };
    }
    if (path === '/api/admin/config' && options.method !== 'PUT') {
      return { ok: true, status: 200, json: async () => config };
    }
    return { ok: true, status: 204 };
  }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);
  await user.click(screen.getByRole('button', { name: '展开 星屿积分榜' }));
  await user.click(screen.getByRole('tab', { name: '积分队员' }));
  await user.click(screen.getByRole('button', { name: '删除积分队员 1' }));
  await user.click(screen.getByRole('button', { name: '保存全部配置' }));

  const saveCall = fetch.mock.calls.find(([path, options]) =>
    path === '/api/admin/config' && options?.method === 'PUT');
  const savedConfig = JSON.parse(saveCall[1].body);
  expect(savedConfig.scoreMembers.some((member) => member.id === removedId)).toBe(false);
  expect(savedConfig.dailyScores[0].rows).toEqual([]);
  expect(savedConfig.weekendScores[0].rows).toEqual([]);
  expect(savedConfig.roster[0].scoreMemberId).toBe('');
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

it('toggles news pinned and hidden flags and edits the category list', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  config.news[0].pinned = false;
  config.news[0].hidden = false;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);

  await user.click(screen.getByRole('button', { name: '展开 新闻管理' }));

  const newsSection = screen.getByRole('heading', { name: '新闻管理' }).closest('section');
  expect(within(newsSection).getAllByPlaceholderText('分类名称')).toHaveLength(2);
  await user.click(within(newsSection).getByRole('button', { name: '新增分类' }));
  const categoryInputs = within(newsSection).getAllByPlaceholderText('分类名称');
  expect(categoryInputs).toHaveLength(3);
  await user.type(categoryInputs.at(-1), '赛事');

  await user.click(screen.getByRole('button', { name: '展开 赛季积分榜更新' }));
  const pin = within(newsSection).getByLabelText('置顶');
  expect(pin).not.toBeChecked();
  await user.click(pin);
  expect(pin).toBeChecked();
  const hidden = within(newsSection).getByLabelText('隐藏');
  expect(hidden).not.toBeChecked();
  await user.click(hidden);
  expect(hidden).toBeChecked();

  await user.click(screen.getByRole('button', { name: '保存全部配置' }));

  const savedConfig = JSON.parse(fetch.mock.calls.at(-1)[1].body);
  expect(savedConfig.news[0].pinned).toBe(true);
  expect(savedConfig.news[0].hidden).toBe(true);
  expect(savedConfig.newsCategories).toEqual(['公告', '活动', '赛事']);
});
it('adds albums and photos when crypto.randomUUID is unavailable (LAN http)', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: undefined });

  render(<ConfigEditor initialConfig={config} onAuthError={() => false} />);
  await user.click(screen.getByRole('button', { name: '展开 相册管理' }));
  const section = screen.getByRole('heading', { name: '相册管理' }).closest('section');

  const albumCount = () => within(section).getAllByLabelText('名称').length;
  expect(albumCount()).toBe(3);
  await user.click(within(section).getAllByRole('button', { name: '新增' })[0]);
  expect(albumCount()).toBe(4);

  const cards = section.querySelectorAll('.array-item');
  const newAlbum = cards[cards.length - 1];
  expect(within(newAlbum).getByLabelText('ID').value).not.toBe('');
  expect(within(newAlbum).getByLabelText('访问密码')).toHaveAttribute('type', 'password');
  await user.click(within(newAlbum).getByRole('button', { name: '新增' }));
  expect(within(newAlbum).getAllByLabelText('素材路径上传')).toHaveLength(1);
});
