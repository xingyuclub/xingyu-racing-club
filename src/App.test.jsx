import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import App from './App.jsx';
import { teamData } from './data/teamData.js';
import { createSeedConfig, hydrateSiteData } from './data/siteConfig.js';
import { Hero } from './components/Hero.jsx';
import { VideoModal } from './components/VideoModal.jsx';
import { PhotoModal } from './components/PhotoModal.jsx';
import { FeaturedMembers } from './components/FeaturedMembers.jsx';
import { NewsFeed } from './components/NewsFeed.jsx';

const globalStyles = readFileSync('src/styles/global.css', 'utf8');

let mediaPlay;
let mediaPause;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  mediaPlay = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => new Promise(() => {}));
  mediaPause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  window.location.hash = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('teamData', () => {
  it('defines 8 featured members and 30 roster members', () => {
    expect(teamData.featuredMembers).toHaveLength(8);
    expect(teamData.roster).toHaveLength(30);
  });

  it('keeps featured members inside the full roster', () => {
    const rosterIds = new Set(teamData.roster.map((member) => member.id));
    expect(teamData.featuredMembers.every((member) => rosterIds.has(member.id))).toBe(true);
  });

  it('uses the revised internal team statistics', () => {
    expect(teamData.stats.map((item) => item.label)).toEqual([
      '车队排名',
      '活跃排名',
      '队员数量',
      '单身贵族',
    ]);
  });

  it('configures single-member counts and five featured photos', () => {
    const single = teamData.stats.find((item) => item.label === '单身贵族');

    expect(teamData.stats[0].value).toBe('1st');
    expect(teamData.stats[1].value).toBe('3rd');
    expect(teamData.team.heroMedia).toEqual({ src: '/images/hero-home.png', type: 'image' });
    expect(teamData.team.label).toBe('RACING CLUB');
    expect(single.value).toEqual({ male: 12, female: 8 });
    expect(teamData.gallery.filter((photo) => photo.featured)).toHaveLength(5);
    expect(teamData.gallery.some((photo) => photo.mediaType === 'video')).toBe(true);
  });

  it('defines one captain, four deputies, and three elite featured members', () => {
    const roles = teamData.featuredMembers.map((member) => member.role);

    expect(roles.filter((role) => role === '队长')).toHaveLength(1);
    expect(roles.filter((role) => role === '副队')).toHaveLength(4);
    expect(roles.filter((role) => role === '精英')).toHaveLength(3);
  });

  it('defines configured daily scores for the calendar lookup', () => {
    expect(teamData.dailyScores[0]).toEqual(
      expect.objectContaining({ date: '2026-07-24', weekday: '周五' }),
    );
    expect(teamData.dailyScores[0].rows).toHaveLength(30);
    expect(teamData.dailyScores[0].rows[0]).toEqual(
      expect.objectContaining({
        teamRace: [1, 6, 5],
        openRace: [1, 3, 2],
        score: 18,
      }),
    );
  });
});

describe('App', () => {
  it('renders the server configuration after it loads', async () => {
    const configuredTeamName = '欢迎来到星⁡⁠屿';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...teamData,
        team: { ...teamData.team, name: configuredTeamName, heroLines: [configuredTeamName] },
        stats: teamData.stats.map((item, index) =>
          index === 0 ? { ...item, label: '实时配置' } : item,
        ),
        music: { src: '/uploads/song.mp3', cover: '/uploads/cover.png' },
      }),
    }));

    render(<App />);

    expect(await screen.findByText('实时配置')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: configuredTeamName })).toBeInTheDocument();
  });

  it('refreshes server configuration when the page regains focus', async () => {
    const seedConfig = createSeedConfig();
    const initialConfig = hydrateSiteData(seedConfig);
    const updatedConfig = hydrateSiteData({
      ...seedConfig,
      team: { ...seedConfig.team, heroMedia: { src: '/images/updated-hero.png', type: 'image' } },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => initialConfig })
      .mockResolvedValueOnce({ ok: true, json: async () => updatedConfig });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(container.querySelector('.hero-media')).toHaveAttribute('src', '/images/updated-hero.png');
  });

  it('uses initial data when the configuration endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<App />);

    expect(await screen.findByRole('heading', { name: teamData.team.heroLines.join('\n') })).toBeInTheDocument();
  });

  it('renders all main sections from configuration', () => {
    const { container } = render(<App />);

    expect(screen.queryByText('以星为序，向屿而行')).not.toBeInTheDocument();
    expect(screen.queryByText('RACING CLUB')).not.toBeInTheDocument();
    const brandBar = container.querySelector('.hero-brand-bar');
    const heroBrand = container.querySelector('.hero-brand');
    const heroSection = container.querySelector('.hero-section');

    expect(brandBar).toContainElement(heroBrand);
    expect(heroBrand).toHaveAttribute('aria-label', teamData.team.heroLines.join('\n'));
    expect(heroBrand.querySelectorAll('.hero-brand-line')).toHaveLength(teamData.team.heroLines.length);
    expect(heroBrand.querySelectorAll('.animated-gradient-text')).toHaveLength(teamData.team.heroLines.length);
    expect(heroBrand.querySelectorAll('.gradient-text-content')).toHaveLength(teamData.team.heroLines.length);
    expect(heroBrand.querySelector('.gradient-text-content').style.backgroundImage)
      .toContain('linear-gradient');
    expect(heroBrand.querySelector('.text-type')).not.toBeInTheDocument();
    expect(heroBrand.querySelector('.text-type__cursor')).not.toBeInTheDocument();
    expect(brandBar.nextElementSibling).toBe(heroSection);
    expect(heroSection.firstElementChild).toHaveClass('hero-media');
    expect(heroSection.firstElementChild.tagName).toBe('IMG');
    expect(heroSection.firstElementChild).toHaveAttribute('src', teamData.team.heroMedia.src);
    expect(heroSection.firstElementChild).toHaveAttribute('alt', '');
    expect(container.querySelector('.hero-motto')).not.toBeInTheDocument();
    expect(screen.queryByText('RACING CLUB / 2026 SEASON')).not.toBeInTheDocument();
    expect(screen.queryByText('09 / 30')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '车队风采' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '队员阵容' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '星屿积分榜' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '车队动态' })).toBeInTheDocument();
  });

  it('promotes the welcome heading and keeps the slogan non-heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: teamData.team.heroLines.join('\n') })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: teamData.team.motto })).not.toBeInTheDocument();
  });

  it('renders 8 featured member buttons and 30 roster cards', () => {
    const { container } = render(<App />);

    expect(screen.getAllByRole('button', { name: /查看成员 \d+ 高光视频/ })).toHaveLength(8);
    const roster = screen.getByTestId('roster-grid');
    expect(roster).toHaveClass('roster-wheel--cinematic');
    expect(roster).toHaveClass('roster-wheel--ambient');
    expect(roster).toHaveClass('roster-wheel--cylindrical');
    expect(within(roster).getAllByTestId('roster-card')).toHaveLength(30);
    expect(within(roster).getAllByTestId('roster-avatar')).toHaveLength(30);
    expect(within(roster).getByRole('button', { name: '查看成员 01 卡片详情' })).toBeInTheDocument();
  });

  it('renders a click-to-play muted looping hero video', () => {
    const config = hydrateSiteData({
      ...createSeedConfig(),
      team: {
        ...createSeedConfig().team,
        heroMedia: { src: '/uploads/hero.mp4', type: 'video' },
        heroFallbackImage: '/uploads/fallback.png',
      },
    });

    render(<Hero team={config.team} />);

    const video = document.querySelector('video.hero-media');
    expect(video).toHaveAttribute('src', '/uploads/hero.mp4');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('loop');
    expect(video).toHaveAttribute('playsinline');
    expect(video).not.toHaveAttribute('controls');
    expect(document.querySelector('.hero-play-button')).toBeInTheDocument();
  });

  it('shows a poster image and play button until the video starts playing', () => {
    const seed = createSeedConfig();
    const config = hydrateSiteData({
      ...seed,
      team: {
        ...seed.team,
        heroMedia: { src: '/uploads/hero.mp4', type: 'video' },
        heroFallbackImage: '',
      },
    });

    const { container } = render(<Hero team={config.team} />);
    const poster = container.querySelector('img.hero-media--poster');
    const video = container.querySelector('video.hero-media');

    expect(poster).toHaveAttribute('src', '/images/hero-home.png');
    expect(video).toHaveClass('hero-media--pending');
    expect(container.querySelector('.hero-play-button')).toBeInTheDocument();

    fireEvent.playing(video);

    expect(video).not.toHaveClass('hero-media--pending');
    expect(container.querySelector('.hero-play-button')).not.toBeInTheDocument();
  });

  it('switches a failed hero video to its fallback image', () => {
    const seed = createSeedConfig();
    const config = hydrateSiteData({
      ...seed,
      team: {
        ...seed.team,
        heroMedia: { src: '/uploads/hero.mp4', type: 'video' },
        heroFallbackImage: '/uploads/fallback.png',
      },
    });

    const { container } = render(<Hero team={config.team} />);
    fireEvent.error(container.querySelector('video.hero-media'));

    expect(container.querySelector('video.hero-media')).not.toBeInTheDocument();
    expect(container.querySelector('img.hero-media')).toHaveAttribute('src', '/uploads/fallback.png');
  });

  it('switches to fallback when clicking play fails to load the video', async () => {
    const seed = createSeedConfig();
    const config = hydrateSiteData({
      ...seed,
      team: {
        ...seed.team,
        heroMedia: { src: '/uploads/hero.mp4', type: 'video' },
        heroFallbackImage: '/uploads/fallback.png',
      },
    });

    const { container } = render(<Hero team={config.team} />);

    fireEvent.click(container.querySelector('.hero-play-button'));

    await waitFor(() => {
      expect(container.querySelector('.hero-media')).toHaveAttribute('src', '/uploads/fallback.png');
    });
  });


  it('renders the fallback image when the hero primary media is empty', () => {
    const seed = createSeedConfig();
    const config = hydrateSiteData({
      ...seed,
      team: {
        ...seed.team,
        heroMedia: { src: '', type: 'image' },
        heroFallbackImage: '/uploads/fallback.png',
      },
    });

    const { container } = render(<Hero team={config.team} />);

    expect(container.querySelector('.hero-media')).toHaveAttribute('src', '/uploads/fallback.png');
    expect(container.querySelector('.hero-section')).not.toHaveClass('hero-section--empty');
  });

  it('uses the empty hero placeholder when the fallback image also fails', () => {
    const seed = createSeedConfig();
    const team = {
      ...seed.team,
      heroMedia: { src: '', type: 'image' },
      heroFallbackImage: '/uploads/missing.png',
    };

    const { container } = render(<Hero team={team} />);
    fireEvent.error(container.querySelector('img.hero-media'));

    expect(container.querySelector('img.hero-media')).not.toBeInTheDocument();
    expect(container.querySelector('.hero-section')).toHaveClass('hero-section--empty');
  });

  it('renders stat card borders without the outer electric frame', () => {
    const { container } = render(<App />);

    expect(container.querySelectorAll('.stats-bar .electric-border')).toHaveLength(0);
    const statShells = container.querySelectorAll('.stats-bar .star-border-container');
    expect(statShells).toHaveLength(4);
    statShells.forEach((shell) => {
      expect(shell.style.getPropertyValue('--stat-accent')).not.toBe('');
      expect(shell.querySelector('.stat-number')).toBeInTheDocument();
      expect(shell.querySelector('.stat-label')).toBeInTheDocument();
    });
    expect(container.querySelector('.leaderboard-frame .electric-border-canvas')).not.toBeInTheDocument();
  });

  it('arranges the full roster around an auto-rolling cylinder', () => {
    render(<App />);

    const roster = screen.getByTestId('roster-grid');
    const cylinder = within(roster).getByTestId('roster-cylinder');
    const cards = within(roster).getAllByTestId('roster-card');
    const rotation = Number.parseFloat(cylinder.style.getPropertyValue('--rotation'));

    expect(cylinder).toHaveStyle({ '--member-count': '30' });
    expect(rotation).toBeCloseTo(0, 3);
    expect(cylinder.style.getPropertyValue('--speed')).toContain('deg/s');
    expect(cards[0]).toHaveStyle({ '--card-angle': '0deg' });
    expect(cards[1]).toHaveStyle({ '--card-angle': '12deg' });
    expect(cards[6]).toHaveClass('is-visible');
    expect(cards[7]).toHaveAttribute('aria-hidden', 'true');
    expect(cards.filter((card) => card.classList.contains('is-centered'))).toEqual([cards[0]]);
  });

  it('keeps touch swipes interactive without entering the desktop hover pause state', () => {
    render(<App />);

    const roster = screen.getByTestId('roster-grid');
    const cylinder = within(roster).getByTestId('roster-cylinder');
    const card = within(roster).getAllByTestId('roster-card')[0];
    const initialRotation = Number.parseFloat(cylinder.style.getPropertyValue('--rotation'));
    const touchPointerEvent = (type, clientX = 0) => {
      const event = new MouseEvent(type, { bubbles: true, clientX });
      Object.defineProperties(event, {
        pointerId: { value: 7 },
        pointerType: { value: 'touch' },
      });
      return event;
    };

    fireEvent(card, touchPointerEvent('pointerover'));
    fireEvent(roster, touchPointerEvent('pointerdown', 260));
    fireEvent(roster, touchPointerEvent('pointermove', 140));
    fireEvent(roster, touchPointerEvent('pointerup', 140));

    expect(Number.parseFloat(cylinder.style.getPropertyValue('--rotation'))).not.toBe(initialRotation);
    expect(card).not.toHaveClass('is-hovered');
    expect(roster).not.toHaveClass('is-paused');
    expect(roster).toHaveClass('is-settling');
  });

  it('pauses automatic roster rotation while a finger is held down and resumes on release', async () => {
    vi.useFakeTimers();
    render(<App />);

    const roster = screen.getByTestId('roster-grid');
    const cylinder = within(roster).getByTestId('roster-cylinder');
    const touchPointerEvent = (type, clientX = 0) => {
      const event = new MouseEvent(type, { bubbles: true, clientX });
      Object.defineProperties(event, {
        pointerId: { value: 8 },
        pointerType: { value: 'touch' },
      });
      return event;
    };

    fireEvent(roster, touchPointerEvent('pointerdown', 220));
    const heldRotation = Number.parseFloat(cylinder.style.getPropertyValue('--rotation'));

    expect(roster).toHaveClass('is-paused');
    expect(Number.parseFloat(cylinder.style.getPropertyValue('--speed'))).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    expect(Number.parseFloat(cylinder.style.getPropertyValue('--rotation'))).toBeCloseTo(heldRotation, 3);

    fireEvent(roster, touchPointerEvent('pointerup', 220));
    expect(roster).toHaveClass('is-settling');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    expect(Number.parseFloat(cylinder.style.getPropertyValue('--rotation'))).not.toBeCloseTo(heldRotation, 3);
  });

  it('opens a roster video after a touch tap with slight finger movement', () => {
    render(<App />);

    const roster = screen.getByTestId('roster-grid');
    const card = within(roster).getAllByTestId('roster-card')[0];
    const touchPointerEvent = (type, clientX) => {
      const event = new MouseEvent(type, { bubbles: true, clientX });
      Object.defineProperties(event, {
        pointerId: { value: 9 },
        pointerType: { value: 'touch' },
      });
      return event;
    };

    fireEvent(card, touchPointerEvent('pointerdown', 220));
    fireEvent(card, touchPointerEvent('pointermove', 214));
    fireEvent(card, touchPointerEvent('pointerup', 214));
    fireEvent.click(card);

    expect(screen.getByRole('dialog')).toHaveTextContent('高光视频素材待替换');
  });

  it('accelerates the roster cylinder in the swipe direction and eases back to base speed', async () => {
    vi.useFakeTimers();
    render(<App />);

    const roster = screen.getByTestId('roster-grid');
    const cylinder = within(roster).getByTestId('roster-cylinder');
    const readSpeed = () => Number.parseFloat(cylinder.style.getPropertyValue('--speed'));
    const baseSpeed = 10.59;

    fireEvent(roster, new MouseEvent('pointerdown', { bubbles: true, clientX: 260 }));
    fireEvent(roster, new MouseEvent('pointermove', { bubbles: true, clientX: 130 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80);
    });

    expect(roster).toHaveClass('is-accelerating');
    const acceleratedSpeed = readSpeed();
    expect(acceleratedSpeed).toBeGreaterThan(baseSpeed);

    fireEvent(roster, new MouseEvent('pointermove', { bubbles: true, clientX: 290 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(240);
    });

    expect(readSpeed()).toBeLessThan(acceleratedSpeed);

    fireEvent(roster, new MouseEvent('pointerup', { bubbles: true, clientX: 290 }));

    expect(roster).not.toHaveClass('is-accelerating');
    expect(roster).toHaveClass('is-settling');

    act(() => vi.advanceTimersByTime(160));
    expect(readSpeed()).toBeLessThan(acceleratedSpeed);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(readSpeed()).toBeLessThan(acceleratedSpeed);
    expect(roster).toHaveClass('is-settling');
  });

  it('pauses the roster cylinder on hover and enlarges the hovered card', async () => {
    vi.useFakeTimers();
    render(<App />);

    const roster = screen.getByTestId('roster-grid');
    const cylinder = within(roster).getByTestId('roster-cylinder');
    const card = within(roster).getAllByTestId('roster-card')[0];
    const readSpeed = () => Number.parseFloat(cylinder.style.getPropertyValue('--speed'));

    fireEvent.pointerEnter(roster);
    fireEvent.pointerEnter(card);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(roster).toHaveClass('is-paused');
    expect(card).toHaveClass('is-hovered');
    expect(Math.abs(readSpeed())).toBeLessThan(1);

    fireEvent.pointerLeave(card);
    fireEvent.pointerLeave(roster);
    expect(card).not.toHaveClass('is-hovered');
  });

  it('opens member details from a full roster card', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '查看成员 01 卡片详情' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('成员 01')).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent('高光视频素材待替换');
  });

  it('renders an eight-card synced driver carousel', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    expect(container.querySelector('.carousel-viewport')).not.toHaveClass('carousel-viewport--coverflow');
    expect(container.querySelectorAll('.carousel-dot')).toHaveLength(8);
    expect(container.querySelector('.driver-card.is-active')).toHaveTextContent('成员 01');

    await user.click(screen.getByRole('button', { name: '切换至成员 03' }));
    expect(container.querySelector('.driver-card.is-active')).toHaveTextContent('成员 03');
  });

  it('keeps primary member covers clear while preserving positional depth', () => {
    const style = document.createElement('style');
    style.textContent = globalStyles;
    document.head.append(style);
    const rules = Array.from(style.sheet.cssRules);
    const ruleStyle = (selector) => rules.find((rule) => rule.selectorText === selector)?.style;

    expect(ruleStyle('.driver-portrait::after').opacity).toBe('1');
    expect(ruleStyle('.driver-card.is-next').opacity).toBe('0.72');
    expect(ruleStyle('.roster-card').filter).toBe('none');
    expect(ruleStyle('.roster-card').opacity).toContain('--card-opacity');
    expect(ruleStyle('.roster-avatar').opacity).toBe('1');
    expect(ruleStyle('.roster-card::before')).toBeUndefined();

    style.remove();
  });

  it('auto-advances the featured carousel when reduced motion is enabled', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const { container } = render(
      <FeaturedMembers members={teamData.featuredMembers} onSelect={vi.fn()} />,
    );

    act(() => vi.advanceTimersByTime(4000));

    expect(container.querySelector('.driver-card.is-active')).toHaveTextContent('成员 02');
  });

  it('keeps featured card transitions smooth when reduced motion is enabled', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const { container } = render(
      <FeaturedMembers members={teamData.featuredMembers} onSelect={vi.fn()} />,
    );

    const activeCard = container.querySelector('.driver-card.is-active');
    expect(activeCard).toHaveClass('carousel-card');
  });

  it('switches to the next driver after a left swipe', () => {
    const { container } = render(<App />);
    const viewport = container.querySelector('.carousel-viewport');

    fireEvent(viewport, new MouseEvent('pointerdown', { bubbles: true, clientX: 250 }));
    fireEvent(viewport, new MouseEvent('pointerup', { bubbles: true, clientX: 150 }));

    expect(container.querySelector('.driver-card.is-active')).toHaveTextContent('成员 02');
  });

  it('shows five featured photos and opens the full album view', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getAllByTestId('featured-photo')).toHaveLength(5);
    expect(screen.getAllByTestId('featured-photo')[0].querySelector('img')).toHaveClass('photo-card-image--contain');
    expect(screen.getByRole('button', { name: '查看视频车队记录 02' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看更多相册' }));

    expect(window.location.hash).toBe('#album');
    expect(screen.getByRole('heading', { name: '车队相册' })).toBeInTheDocument();
    expect(screen.getAllByTestId('album-folder')).toHaveLength(teamData.albums.length);

    await user.click(screen.getAllByTestId('album-folder')[0]);
    expect(screen.getAllByTestId('album-photo')).toHaveLength(teamData.albums[0].photos.length);
    expect(screen.getAllByTestId('album-photo')[0].querySelector('img')).not.toHaveClass('photo-card-image--contain');
  });

  it('opens and closes a configured photo preview', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '查看赛季全家福' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('赛季全家福');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a configured album video preview', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '查看视频车队记录 02' }));
    const dialog = screen.getByRole('dialog');

    expect(dialog).toHaveTextContent('车队记录 02');
    expect(dialog).toHaveTextContent('视频素材待替换');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the score lookup entry with the supplied icon and Chinese score unit', () => {
    const { container } = render(<App />);

    expect(screen.getByRole('heading', { name: '星屿积分榜' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查找' })).toBeInTheDocument();
    expect(container.querySelector('.section-heading--action-right')).toBeInTheDocument();
    expect(container.querySelector('.text-action--stacked')).toBeInTheDocument();
    expect(container.querySelector('.score-search-icon')).toHaveAttribute(
      'src',
      '/images/icons/search.png',
    );
    // 排行榜显示最新日期所在周的“总分”。
    expect(container.querySelector('.leader-score')).toHaveTextContent('98分');
    expect(screen.queryByText('PTS')).not.toBeInTheDocument();
  });

  it('opens the daily score calendar and shows points for a selected date', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '查找' }));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByRole('heading', { name: '日期积分查询' })).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: '查看 2026年7月24日积分' }),
    );

    expect(dialog).toHaveTextContent('2026年7月24日 · 周五');
    expect(dialog).toHaveTextContent('队内赛');
    expect(dialog).toHaveTextContent('开黑赛');
    expect(dialog).toHaveTextContent('得分');
    expect(dialog).toHaveTextContent('总分');
    expect(within(dialog).getAllByTestId('daily-score-row')).toHaveLength(30);

    await user.click(
      within(dialog).getByRole('button', { name: '查看 2026年7月23日积分' }),
    );
    expect(dialog).toHaveTextContent('当日暂无积分记录');
  });

  it('auto-plays a configured member video', () => {
    const { container } = render(
      <VideoModal
        member={{ name: '成员 01', videoUrl: '/videos/member-01.mp4' }}
        onClose={() => {}}
      />,
    );

    expect(container.querySelector('video')).toHaveAttribute('autoplay');
  });

  it('gives member videos a larger edge-to-edge 16:9 viewing area', () => {
    const { container } = render(
      <VideoModal
        member={{ name: '成员 01', signature: '一路向星光', videoUrl: '/videos/member-01.mp4' }}
        onClose={() => {}}
      />,
    );

    expect(container.querySelector('.member-video-signature')).toHaveTextContent('一路向星光');
    expect(globalStyles).toMatch(
      /\.member-video-modal\s*\{[^}]*width:\s*min\(100vw,\s*calc\(\(100dvh\s*-\s*52px\)\s*\*\s*16\s*\/\s*9\)\)/s,
    );
    expect(globalStyles).toMatch(/\.member-video-modal\s*\{[^}]*max-height:\s*100dvh/s);
    expect(globalStyles).toMatch(/\.member-video-modal\s*\{[^}]*padding:\s*0/s);
    expect(globalStyles).toMatch(/\.member-video-modal\s*>\s*video\s*\{[^}]*margin-top:\s*0/s);
  });

  it('shows a non-empty signature above the video without name or close button', () => {
    const { container } = render(
      <VideoModal
        member={{ name: '成员 01', signature: '一路向星光', videoUrl: '/videos/member-01.mp4' }}
        onClose={() => {}}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const signature = within(dialog).getByText('一路向星光');
    const video = container.querySelector('video');
    expect(container.querySelector('.modal-backdrop')).toHaveClass('video-modal-backdrop');
    expect(signature.compareDocumentPosition(video) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dialog).queryByText('成员 01')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '关闭视频弹窗' })).not.toBeInTheDocument();
    expect(globalStyles).toMatch(/\.video-modal-backdrop\s*\{[^}]*padding:\s*0/s);
    expect(globalStyles).toMatch(/\.member-video-modal\s*\{[^}]*max-height:\s*100dvh/s);
    expect(globalStyles).toMatch(/\.member-video-signature\s*\{[^}]*text-align:\s*center/s);
  });

  it('omits a blank member signature', () => {
    const { container } = render(
      <VideoModal member={{ name: '成员 01', signature: '  ', videoUrl: '/member.mp4' }} onClose={() => {}} />,
    );

    expect(container.querySelector('.member-video-signature')).not.toBeInTheDocument();
  });

  it('closes only from blank backdrop clicks', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <VideoModal member={{ signature: '一路向星光', videoUrl: '/member.mp4' }} onClose={onClose} />,
    );

    await user.click(container.querySelector('video'));
    await user.click(screen.getByText('一路向星光'));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(container.querySelector('.video-modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders a playable video when an album item has a video URL', () => {
    const { container } = render(
      <PhotoModal
        photo={{
          title: '训练视频',
          src: '/images/album/placeholder-01.jpg',
          videoUrl: '/videos/team-preview.mp4',
          alt: '训练视频封面',
        }}
        onClose={() => {}}
      />,
    );

    expect(container.querySelector('video')).toHaveAttribute('src', '/videos/team-preview.mp4');
    expect(container.querySelector('video')).toHaveAttribute(
      'poster',
      '/images/album/placeholder-01.jpg',
    );
  });

  it('opens and closes the member video dialog', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '查看成员 01 高光视频' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).queryByText('成员 01')).not.toBeInTheDocument();
    expect(screen.getByText('高光视频素材待替换')).toBeInTheDocument();

    await user.click(document.querySelector('.video-modal-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the member dialog with Escape and restores body scrolling', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '查看成员 01 高光视频' }));
    expect(document.body).toHaveClass('modal-open');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('modal-open');
  });

  it('closes the member dialog when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole('button', { name: '查看成员 01 高光视频' }));
    await user.click(container.querySelector('.modal-backdrop'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reveals content immediately when IntersectionObserver is unavailable', () => {
    const { container } = render(<App />);

    expect(container.querySelector('[data-reveal]')).toHaveClass('is-visible');
  });

  it('marks every homepage section for scroll reveal', () => {
    const { container } = render(<App />);
    const selectors = [
      '.hero-module',
      '.stats-bar',
      '.featured-section',
      '.gallery-section',
      '[aria-labelledby="roster-title"]',
      '[aria-labelledby="leaderboard-title"]',
      '.news-section',
    ];

    selectors.forEach((selector) => {
      expect(container.querySelector(selector)).toHaveAttribute('data-reveal');
    });
  });

  it('marks the music player and every public dialog for immediate entrance', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    expect(container.querySelector('.music-player')).toHaveAttribute('data-entrance');

    await user.click(screen.getByRole('button', { name: '查看成员 01 高光视频' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-entrance');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: '查看赛季全家福' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-entrance');
    await user.keyboard('{Escape}');

    await user.click(screen.getAllByRole('button', { name: /查看资讯/ })[0]);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-entrance');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: '查找' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-entrance');
  });

  it('reveals album folders and photos when switching views', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole('button', { name: '查看更多相册' }));

    expect(container.querySelector('.album-header')).toHaveAttribute('data-reveal');
    expect(container.querySelector('.album-folder-grid')).toHaveClass('is-visible');
    expect(screen.getAllByTestId('album-folder')[0].style.getPropertyValue('--stagger-index')).toBe('0');
    expect(screen.getAllByTestId('album-folder')[1].style.getPropertyValue('--stagger-index')).toBe('1');

    await user.click(screen.getAllByTestId('album-folder')[0]);

    expect(container.querySelector('.album-grid')).toHaveAttribute('data-reveal');
    expect(container.querySelector('.album-grid')).toHaveClass('is-visible');
    expect(screen.getAllByTestId('album-photo')[0].style.getPropertyValue('--stagger-index')).toBe('0');
  });

  it('defines unified entrance motion with a reduced-motion fallback', () => {
    expect(globalStyles).toMatch(
      /\[data-entrance\]\s*\{[^}]*animation:\s*modal-in\s+280ms/s,
    );
    expect(globalStyles).toMatch(
      /\[data-reveal\]\.is-visible\s*>\s*\.album-folder,[\s\S]*animation:\s*modal-in\s+420ms/s,
    );
    expect(globalStyles).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\[data-entrance\],[\s\S]*animation:\s*none\s*!important/s,
    );
  });

  it('renders the revised editorial structure', () => {
    const { container } = render(<App />);

    expect(container.querySelector('.hero-frame')).not.toBeInTheDocument();
    expect(container.querySelector('.hero-topline')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.leader-row.is-podium')).toHaveLength(3);
    expect(container.querySelectorAll('.leader-row')).toHaveLength(10);
    expect(container.querySelector('.news-image')).toBeInTheDocument();
    expect(screen.queryAllByText(/\d+ 胜/)).toHaveLength(0);
  });

  it('uses the mobile-first site shell', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.site-shell')).toBeInTheDocument();
    expect(container.querySelector('.hero-section')).toBeInTheDocument();
    expect(container.querySelector('.stats-bar')).toBeInTheDocument();
  });

  it('auto-plays looping background music from the floating avatar', async () => {
    mediaPlay.mockResolvedValue();
    const { container } = render(<App />);
    const audio = container.querySelector('audio');

    await waitFor(() => expect(mediaPlay).toHaveBeenCalled());
    expect(audio).toHaveAttribute('src', '/audio/launch-now.mp3');
    expect(audio).toHaveAttribute('autoplay');
    expect(audio).toHaveAttribute('loop');
    expect(
      screen.getByRole('button', { name: '音乐播放中，点击暂停，长按关闭' }),
    ).toHaveClass('is-playing');
  });

  it('pauses and resumes music when the avatar is clicked', async () => {
    mediaPlay.mockResolvedValue();
    const user = userEvent.setup();
    render(<App />);

    const playingButton = await screen.findByRole('button', {
      name: '音乐播放中，点击暂停，长按关闭',
    });
    await user.click(playingButton);
    expect(mediaPause).toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: '音乐已暂停，点击继续，长按关闭' }),
    );
    expect(mediaPlay).toHaveBeenCalledTimes(2);
  });

  it('retries blocked autoplay on the first page interaction', async () => {
    mediaPlay.mockRejectedValueOnce(new Error('autoplay blocked')).mockResolvedValueOnce();
    render(<App />);

    await waitFor(() => expect(mediaPlay).toHaveBeenCalledTimes(1));
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(mediaPlay).toHaveBeenCalledTimes(2));
  });

  it('stops and closes the music player after a long press', () => {
    vi.useFakeTimers();
    mediaPlay.mockImplementation(() => new Promise(() => {}));
    render(<App />);

    const player = screen.getByRole('button', {
      name: '音乐已暂停，点击继续，长按关闭',
    });
    fireEvent.pointerDown(player);
    act(() => vi.advanceTimersByTime(650));

    expect(mediaPause).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /音乐/ })).not.toBeInTheDocument();
  });

  it('allows the floating music avatar to be dragged vertically without toggling playback', () => {
    vi.useFakeTimers();
    mediaPlay.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<App />);
    const player = screen.getByRole('button', { name: '音乐已暂停，点击继续，长按关闭' });
    vi.spyOn(player, 'getBoundingClientRect').mockReturnValue({
      top: 272,
      height: 56,
      bottom: 328,
      left: 334,
      right: 390,
      width: 56,
      x: 334,
      y: 272,
      toJSON: () => ({}),
    });

    fireEvent(player, new MouseEvent('pointerdown', { bubbles: true, clientX: 350, clientY: 300 }));
    fireEvent(player, new MouseEvent('pointermove', { bubbles: true, clientX: 430, clientY: 520 }));
    fireEvent(player, new MouseEvent('pointerup', { bubbles: true, clientX: 430, clientY: 520 }));
    fireEvent.click(player);
    act(() => vi.advanceTimersByTime(1000));

    expect(player.style.top).toBe('492px');
    expect(player.style.left).toBe('');
    expect(container.querySelector('.music-player')).toBeInTheDocument();
    expect(mediaPlay).toHaveBeenCalledTimes(1);
    expect(mediaPause).not.toHaveBeenCalled();
  });

  it('allows the next deliberate tap after a drag to control playback', () => {
    vi.useFakeTimers();
    mediaPlay.mockImplementation(() => new Promise(() => {}));
    render(<App />);
    const player = screen.getByRole('button', { name: '音乐已暂停，点击继续，长按关闭' });
    vi.spyOn(player, 'getBoundingClientRect').mockReturnValue({
      top: 272,
      height: 56,
      bottom: 328,
      left: 334,
      right: 390,
      width: 56,
      x: 334,
      y: 272,
      toJSON: () => ({}),
    });

    fireEvent(player, new MouseEvent('pointerdown', { bubbles: true, clientY: 300 }));
    fireEvent(player, new MouseEvent('pointermove', { bubbles: true, clientY: 420 }));
    fireEvent(player, new MouseEvent('pointerup', { bubbles: true, clientY: 420 }));
    act(() => vi.advanceTimersByTime(1));
    fireEvent.click(player);

    expect(mediaPlay).toHaveBeenCalledTimes(2);
  });

  it('uses icons instead of visible gender labels in the single-member stat', () => {
    const { container } = render(<App />);
    const breakdown = container.querySelector('.stat-breakdown');

    expect(container.querySelectorAll('.stat-card > small')).toHaveLength(0);
    expect(screen.queryByText(/男：12/)).not.toBeInTheDocument();
    expect(screen.queryByText(/女：8/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('男性单身成员 12')).toBeInTheDocument();
    expect(screen.getByLabelText('女性单身成员 8')).toBeInTheDocument();
    expect(container.querySelector('.gender-icon[src="/images/icons/gender-male.png"]')).toBeInTheDocument();
    expect(container.querySelector('.gender-icon[src="/images/icons/gender-female.png"]')).toBeInTheDocument();
    expect(breakdown).toHaveClass('stat-breakdown--stacked');
  });

  it('renders rank suffixes as superscript text', () => {
    const { container } = render(<App />);

    expect(container.querySelectorAll('.stat-value')).toHaveLength(2);
    expect(container.querySelectorAll('.ordinal-suffix')).toHaveLength(2);
    expect(container.querySelectorAll('sup.ordinal-suffix')[0]).toHaveTextContent('st');
    expect(container.querySelectorAll('sup.ordinal-suffix')[1]).toHaveTextContent('rd');
  });

  it('opens a news detail with text and image', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getAllByTestId('news-image')).toHaveLength(teamData.news.length);

    await user.click(screen.getByRole('button', { name: '查看资讯 赛季积分榜更新' }));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByRole('heading', { name: '赛季积分榜更新' })).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: '赛季积分榜更新资讯图' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(teamData.news[0].summary);

    await user.click(screen.getByRole('button', { name: '关闭资讯弹窗' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders rich news content with links and multiple inline images', async () => {
    const user = userEvent.setup();
    const item = {
      ...teamData.news[0],
      bodyHtml: '<h2>比赛规则</h2><p style="color:#ff0000;font-family:SimHei;font-size:20px"><strong>重点</strong></p><ul><li>第一局</li></ul><a href="https://example.com" target="_blank" rel="noopener noreferrer">规则链接</a><img src="/uploads/a.jpg" alt="正文图一"><img src="/uploads/b.jpg" alt="正文图二">',
    };
    render(<NewsFeed items={[item]} />);

    await user.click(screen.getByRole('button', { name: `查看资讯 ${item.title}` }));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByRole('heading', { name: '比赛规则' })).toBeInTheDocument();
    expect(within(dialog).getByText('重点').closest('p')).toHaveAttribute('style', expect.stringContaining('font-family:SimHei'));
    expect(within(dialog).getByRole('list')).toHaveTextContent('第一局');
    expect(within(dialog).getByRole('link', { name: '规则链接' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(dialog).getByRole('img', { name: '正文图一' })).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: '正文图二' })).toBeInTheDocument();
    expect(dialog.querySelector('.news-article-content')).toBeInTheDocument();
    expect(within(dialog).getByText(item.date)).toHaveAttribute('datetime', item.date);
  });

  it('falls back to the legacy plain news body', async () => {
    const user = userEvent.setup();
    render(<NewsFeed items={[teamData.news[0]]} />);

    await user.click(screen.getByRole('button', { name: `查看资讯 ${teamData.news[0].title}` }));

    expect(screen.getByRole('dialog')).toHaveTextContent(teamData.news[0].body);
    expect(screen.getByRole('dialog').querySelector('.news-article-legacy')).toBeInTheDocument();
  });
});
