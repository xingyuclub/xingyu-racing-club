import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from './App.jsx';
import { teamData } from './data/teamData.js';
import { VideoModal } from './components/VideoModal.jsx';
import { PhotoModal } from './components/PhotoModal.jsx';

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
    expect(teamData.team.heroImage).toBe('/images/hero-home.png');
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...teamData,
        stats: teamData.stats.map((item, index) =>
          index === 0 ? { ...item, label: '实时配置' } : item,
        ),
        music: { src: '/uploads/song.mp3', cover: '/uploads/cover.png' },
      }),
    }));

    render(<App />);

    expect(await screen.findByText('实时配置')).toBeInTheDocument();
  });

  it('uses initial data when the configuration endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<App />);

    expect(await screen.findByRole('heading', { name: '欢迎来到星屿车队' })).toBeInTheDocument();
  });

  it('renders all main sections from configuration', () => {
    const { container } = render(<App />);

    expect(screen.getByText('欢迎来到星屿车队')).toBeInTheDocument();
    expect(screen.queryByText('以星为序，向屿而行')).not.toBeInTheDocument();
    expect(screen.queryByText('RACING CLUB')).not.toBeInTheDocument();
    const brandBar = container.querySelector('.hero-brand-bar');
    const heroSection = container.querySelector('.hero-section');

    expect(brandBar).toHaveTextContent('欢迎来到星屿车队');
    expect(brandBar).toContainElement(container.querySelector('.hero-brand'));
    expect(brandBar).not.toHaveClass('animated-gradient-text');
    expect(brandBar.nextElementSibling).toBe(heroSection);
    expect(heroSection.firstElementChild).toHaveClass('hero-media');
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

    expect(screen.getByRole('heading', { name: '欢迎来到星屿车队' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: teamData.team.motto })).not.toBeInTheDocument();
  });

  it('renders 8 featured member buttons and 30 roster cards', () => {
    render(<App />);

    expect(screen.getAllByRole('button', { name: /查看成员 \d+ 高光视频/ })).toHaveLength(8);
    const roster = screen.getByTestId('roster-grid');
    expect(roster).toHaveClass('roster-wheel--cinematic');
    expect(roster).toHaveClass('roster-wheel--ambient');
    expect(roster).toHaveClass('roster-wheel--cylindrical');
    expect(within(roster).getAllByTestId('roster-card')).toHaveLength(30);
    expect(within(roster).getAllByTestId('roster-avatar')).toHaveLength(30);
    expect(within(roster).getByRole('button', { name: '查看成员 01 卡片详情' })).toBeInTheDocument();
  });

  it('renders animated borders around stat cards and the leaderboard', () => {
    const { container } = render(<App />);

    expect(container.querySelectorAll('.stats-bar .star-border-container')).toHaveLength(4);
    expect(container.querySelector('.leaderboard-frame .electric-border-canvas')).toBeInTheDocument();
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
    expect(within(dialog).getByRole('heading', { name: '成员 01' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: '查看视频车队记录 02' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看更多相册' }));

    expect(window.location.hash).toBe('#album');
    expect(screen.getByRole('heading', { name: '车队相册' })).toBeInTheDocument();
    expect(screen.getAllByTestId('album-folder')).toHaveLength(teamData.albums.length);

    await user.click(screen.getAllByTestId('album-folder')[0]);
    expect(screen.getAllByTestId('album-photo')).toHaveLength(teamData.albums[0].photos.length);
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
    expect(within(dialog).getByRole('heading', { name: '成员 01' })).toBeInTheDocument();
    expect(screen.getByText('高光视频素材待替换')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '关闭视频弹窗' }));
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
});
