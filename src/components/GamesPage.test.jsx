import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GamesPage } from './GamesPage.jsx';
import { DEFAULT_GAMES } from '../data/games.js';
import { resolvePublicAssetPaths } from '../utils/publicAsset.js';

describe('GamesPage', () => {
  it('opens selected games directly in a separate page with safe link attributes', () => {
    render(<GamesPage />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(DEFAULT_GAMES.length);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    links.forEach((link, index) => {
      expect(link).toHaveAttribute('href', DEFAULT_GAMES[index].url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('hides disabled and invalid links while preserving configured order', () => {
    render(<GamesPage games={[
      { ...DEFAULT_GAMES[1], id: 'first' },
      { ...DEFAULT_GAMES[0], id: 'hidden', enabled: false },
      { ...DEFAULT_GAMES[0], id: 'unsafe', url: 'javascript:alert(1)' },
      { ...DEFAULT_GAMES[0], id: 'second' },
    ]} />);
    expect(screen.getAllByRole('link').map((link) => link.textContent))
      .toEqual(['方块消除', '登山赛车']);
  });

  it('shows an empty state when every game is removed or disabled', () => {
    const { rerender } = render(<GamesPage games={[]} />);
    expect(screen.getByText('暂无上架游戏')).toBeInTheDocument();
    rerender(<GamesPage games={DEFAULT_GAMES.map((game) => ({ ...game, enabled: false }))} />);
    expect(screen.getByText('暂无上架游戏')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps the playable link when an icon fails and retries a changed icon', () => {
    const { container, rerender } = render(<GamesPage games={[DEFAULT_GAMES[0]]} />);
    fireEvent.error(container.querySelector('img'));
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开 登山赛车' })).toBeInTheDocument();
    rerender(<GamesPage games={[{ ...DEFAULT_GAMES[0], iconSrc: '/images/new-game.png' }]} />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/images/new-game.png');
  });

  it('supports a public deployment under a repository base path', () => {
    render(<GamesPage games={resolvePublicAssetPaths(DEFAULT_GAMES, '/xingyu/')} />);
    const images = document.querySelectorAll('.game-icon img');
    expect(images).toHaveLength(8);
    images.forEach((image, index) => {
      expect(image).toHaveAttribute('src', DEFAULT_GAMES[index].iconSrc);
      expect(image.getAttribute('src')).toMatch(
        /^https:\/\/media\.xn--0tr48cxwl51iluvqh7c\.xn--fiqs8s\/games\/icons\/[a-f0-9]{16}-/,
      );
    });
    expect(screen.getByRole('link', { name: '打开 登山赛车' })).toHaveAttribute('href', DEFAULT_GAMES[0].url);
  });

  it('still supports a custom local icon under a repository base path', () => {
    render(<GamesPage games={resolvePublicAssetPaths([
      { ...DEFAULT_GAMES[0], iconSrc: '/images/games/custom.png' },
    ], '/xingyu/')} />);
    expect(document.querySelector('img')).toHaveAttribute('src', '/xingyu/images/games/custom.png');
  });
});
