import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GamesPage } from './GamesPage.jsx';
import { DEFAULT_GAMES, GAME_CATEGORIES } from '../data/games.js';
import { resolvePublicAssetPaths } from '../utils/publicAsset.js';

const originalUserAgent = window.navigator.userAgent;
const racingGames = DEFAULT_GAMES.filter((game) => game.category === 'racing');

function setUserAgent(value) {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

afterEach(() => {
  setUserAgent(originalUserAgent);
  vi.unstubAllGlobals();
});

describe('GamesPage', () => {
  it('defaults to racing, lists 全部 last, and opens games in a separate page', () => {
    render(<GamesPage />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent))
      .toEqual([...GAME_CATEGORIES.map((category) => category.label), '全部']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs.at(-1)).toHaveTextContent('全部');

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(racingGames.length);
    links.forEach((link, index) => {
      expect(link).toHaveAttribute('href', racingGames[index].url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('filters by category and shows the whole catalog under 全部', () => {
    render(<GamesPage />);
    fireEvent.click(screen.getByRole('tab', { name: '益智' }));
    expect(screen.getAllByRole('link')).toHaveLength(
      DEFAULT_GAMES.filter((game) => game.category === 'puzzle').length,
    );

    fireEvent.click(screen.getByRole('tab', { name: '全部' }));
    expect(screen.getAllByRole('link')).toHaveLength(DEFAULT_GAMES.length);
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'games-tab-all');
  });

  it('hides disabled and invalid links while preserving configured order', () => {
    render(<GamesPage games={[
      { ...DEFAULT_GAMES[0], id: 'first' },
      { ...DEFAULT_GAMES[1], id: 'hidden', enabled: false },
      { ...DEFAULT_GAMES[1], id: 'unsafe', url: 'javascript:alert(1)' },
      { ...DEFAULT_GAMES[1], id: 'second' },
    ]} />);
    expect(screen.getAllByRole('link').map((link) => link.textContent))
      .toEqual([DEFAULT_GAMES[0].name, DEFAULT_GAMES[1].name]);
  });

  it('shows an empty state when every game is removed or disabled', () => {
    const { rerender } = render(<GamesPage games={[]} />);
    expect(screen.getByText('暂无上架游戏')).toBeInTheDocument();
    rerender(<GamesPage games={DEFAULT_GAMES.map((game) => ({ ...game, enabled: false }))} />);
    expect(screen.getByText('暂无上架游戏')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps the page clean outside WeChat and opens links without blocking', () => {
    const { rerender } = render(<GamesPage />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    fireEvent.click(screen.getAllByRole('link')[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<GamesPage games={[]} />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('opens the browser guard as soon as WeChat lands on the page', async () => {
    setUserAgent('Mozilla/5.0 (iPhone) MicroMessenger/8.0.49');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<GamesPage />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('请先换到浏览器');
    expect(dialog).toHaveTextContent('微信内置浏览器无法打开游戏');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '复制本页链接' }));
    });
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole('button', { name: '已复制本页链接' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '知道了' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('link')[0]);
    expect(screen.getByRole('dialog')).toHaveTextContent('请先换到浏览器');
  });

  it('keeps the playable link when an icon fails and retries a changed icon', () => {
    const { container, rerender } = render(<GamesPage games={[DEFAULT_GAMES[0]]} />);
    fireEvent.error(container.querySelector('img'));
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: `打开 ${DEFAULT_GAMES[0].name}` })).toBeInTheDocument();
    rerender(<GamesPage games={[{ ...DEFAULT_GAMES[0], iconSrc: '/images/new-game.png' }]} />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/images/new-game.png');
  });

  it('supports a public deployment under a repository base path', () => {
    render(<GamesPage games={resolvePublicAssetPaths(DEFAULT_GAMES, '/xingyu/')} />);
    const images = document.querySelectorAll('.game-icon img');
    expect(images).toHaveLength(racingGames.length);
    expect([...images].map((image) => image.getAttribute('src')))
      .toEqual(racingGames.map((game) => game.iconSrc));
    expect(screen.getByRole('link', { name: `打开 ${racingGames[0].name}` }))
      .toHaveAttribute('href', racingGames[0].url);
  });

  it('still supports a custom local icon under a repository base path', () => {
    render(<GamesPage games={resolvePublicAssetPaths([
      { ...DEFAULT_GAMES[0], iconSrc: '/images/games/custom.png' },
    ], '/xingyu/')} />);
    expect(document.querySelector('img')).toHaveAttribute('src', '/xingyu/images/games/custom.png');
  });
});
