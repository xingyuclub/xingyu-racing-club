import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createSeedConfig } from '../data/siteConfig.js';
import AdminApp from './AdminApp.jsx';

afterEach(() => vi.unstubAllGlobals());

it('logs in, edits public content, uploads a cover, and saves the draft', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 204 })
    .mockResolvedValueOnce({ ok: true, json: async () => config })
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ name: 'cover.png', path: '/uploads/cover.png', type: 'image', size: 5 }) })
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
  await user.upload(screen.getByLabelText('首屏图片上传'), new File(['image'], 'cover.png', { type: 'image/png' }));
  await user.click(screen.getByRole('button', { name: '保存全部配置' }));

  expect(fetch).toHaveBeenLastCalledWith('/api/admin/config', expect.objectContaining({ method: 'PUT' }));
  const savedConfig = JSON.parse(fetch.mock.calls.at(-1)[1].body);
  expect(savedConfig.roster[0].role).toBe('队长');
});
