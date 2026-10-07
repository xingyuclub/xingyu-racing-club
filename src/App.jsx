import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createSeedConfig, hydrateSiteData } from './data/siteConfig.js';
import { Hero } from './components/Hero.jsx';
import { StatsBar } from './components/StatsBar.jsx';
import { FeaturedMembers } from './components/FeaturedMembers.jsx';
import { Roster } from './components/Roster.jsx';
import { LeaderboardPage } from './components/LeaderboardPage.jsx';
import { NewsPage } from './components/NewsPage.jsx';
import { NewsDetailPage } from './components/NewsDetailPage.jsx';
import { MediaStreamViewer } from './components/MediaStreamViewer.jsx';
import { AlbumPage } from './components/AlbumPage.jsx';
import { GamesPage } from './components/GamesPage.jsx';
import { ScoreDetailsPage } from './components/ScoreDetailsPage.jsx';
import { MusicPlayer } from './components/MusicPlayer.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { useRevealOnScroll } from './hooks/useRevealOnScroll.js';
import { useSiteConfig } from './hooks/useSiteConfig.js';
import { resolvePublicAssetPaths } from './utils/publicAsset.js';

const fallbackSiteData = resolvePublicAssetPaths(hydrateSiteData(createSeedConfig()));

const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const TEAM_PREFIX = /^(?:ˣʸ༩)\s*[·._-]\s*/;

const cleanMemberName = (value) =>
  String(value ?? '')
    .normalize('NFC')
    .replace(INVISIBLE_CHARS, '')
    .trim()
    .replace(TEAM_PREFIX, '');

const photoToStreamItem = (photo) => {
  const isVideo = photo.mediaType === 'video' || Boolean(photo.videoUrl);
  return {
    key: photo.id,
    kind: isVideo ? 'video' : 'photo',
    src: isVideo ? photo.videoUrl : photo.src,
    poster: isVideo ? photo.videoPosterSrc || photo.src : undefined,
    downloadSrc: isVideo
      ? photo.videoOriginalUrl || photo.videoUrl
      : photo.originalSrc || photo.src,
    originalUrl: isVideo
      ? photo.videoOriginalUrl || photo.videoUrl
      : photo.originalSrc || photo.src,
    width: isVideo ? photo.videoWidth : photo.width,
    height: isVideo ? photo.videoHeight : photo.height,
    title: photo.title,
    subtitle: photo.date,
  };
};

const memberToStreamItem = (member) => {
  const name = cleanMemberName(member.name);
  return {
    key: member.id,
    kind: 'video',
    src: member.videoUrl,
    poster: member.videoPosterSrc || member.avatarCard || member.avatar,
    width: member.videoWidth,
    height: member.videoHeight,
    title: name.startsWith('@') ? name : `@${name}`,
    signature: member.signature,
  };
};

const parseRoute = () => {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [page, id] = raw.split('/');
  if (page === 'news') {
    return id ? { name: 'news-detail', newsId: decodeURIComponent(id) } : { name: 'news' };
  }
  if (page === 'album') return { name: 'album' };
  if (page === 'games') return { name: 'games' };
  if (page === 'leaderboard') return { name: 'leaderboard' };
  if (page === 'score-details') return { name: 'score-details' };
  return { name: 'home' };
};

const getRouteKey = (route) => (
  route.name === 'news-detail' ? `${route.name}:${route.newsId}` : route.name
);

export default function App() {
  const loadedSiteData = useSiteConfig(fallbackSiteData);
  const siteData = useMemo(() => resolvePublicAssetPaths(loadedSiteData), [loadedSiteData]);
  const [viewer, setViewer] = useState(null);
  const [heroVideoPlaying, setHeroVideoPlaying] = useState(false);
  const [albumResetKey, setAlbumResetKey] = useState(0);
  const [route, setRoute] = useState(parseRoute);
  const routeRef = useRef(route);
  const scrollPositionsRef = useRef(new Map());
  const navigationSessionIdRef = useRef(`${Date.now()}-${Math.random()}`);
  useRevealOnScroll(route.name === 'home');

  const commitRoute = useCallback((nextRoute) => {
    const currentRoute = routeRef.current;
    if (getRouteKey(nextRoute) === getRouteKey(currentRoute)) return;

    scrollPositionsRef.current.set(getRouteKey(currentRoute), window.scrollY);
    routeRef.current = nextRoute;
    setRoute(nextRoute);
  }, []);

  const navigateToHash = useCallback((hash, { replace = false } = {}) => {
    const currentState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state
      : {};
    const nextUrl = hash
      ? `#${hash}`
      : `${window.location.pathname}${window.location.search}`;
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({
      ...currentState,
      xingyuNavigationSession: navigationSessionIdRef.current,
    }, '', nextUrl);
    commitRoute(parseRoute());
  }, [commitRoute]);

  useEffect(() => {
    const handleHistoryChange = () => {
      commitRoute(parseRoute());
    };
    window.addEventListener('hashchange', handleHistoryChange);
    window.addEventListener('popstate', handleHistoryChange);
    return () => {
      window.removeEventListener('hashchange', handleHistoryChange);
      window.removeEventListener('popstate', handleHistoryChange);
    };
  }, [commitRoute]);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    const top = scrollPositionsRef.current.get(getRouteKey(route)) ?? 0;
    window.scrollTo({ top, left: 0, behavior: 'auto' });
  }, [route.name, route.newsId]);

  const goHome = () => {
    navigateToHash('');
  };

  const navigatePrimary = useCallback((hash) => {
    if (hash === 'album' && routeRef.current.name === 'album') {
      setAlbumResetKey((current) => current + 1);
      return;
    }
    navigateToHash(hash);
  }, [navigateToHash]);

  const activePrimaryNav = route.name === 'games'
    ? 'games'
    : route.name === 'leaderboard'
      ? 'leaderboard'
      : route.name === 'news' || route.name === 'news-detail'
        ? 'news'
        : route.name === 'album'
          ? 'album'
          : 'home';

  const goBackFromNewsDetail = () => {
    if (window.history.state?.xingyuNavigationSession === navigationSessionIdRef.current) {
      window.history.back();
      return;
    }
    navigateToHash('news', { replace: true });
  };

  const openPhotoStream = useCallback((photo, list) => {
    const safeList = list && list.length ? list : [photo];
    const startIndex = Math.max(0, safeList.findIndex((candidate) => candidate.id === photo.id));
    setViewer({
      items: safeList.map(photoToStreamItem),
      startIndex,
      showActions: true,
    });
  }, []);

  const openMemberStream = useCallback((member) => {
    if (!member || !member.videoUrl) return;
    // 队伍风采与队员阵容是两份互斥名单，只从 roster 里取会让风采区点谁都播第一个人的视频。
    const seen = new Set();
    const withVideo = [];
    for (const candidate of [...(siteData.featuredMembers || []), ...(siteData.roster || [])]) {
      if (!candidate.videoUrl || seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      withVideo.push(candidate);
    }
    const startIndex = Math.max(0, withVideo.findIndex((candidate) => candidate.id === member.id));
    setViewer({
      items: withVideo.map(memberToStreamItem),
      startIndex,
      showActions: false,
    });
  }, [siteData.featuredMembers, siteData.roster]);

  if (route.name === 'leaderboard') {
    return (
      <>
        <main className="site-shell leaderboard-shell">
          <Hero team={siteData.team} showMedia={false} onVideoPlaybackChange={setHeroVideoPlaying} />
          <LeaderboardPage
            rows={siteData.leaderboard}
            scoreDate={siteData.latestScoreDate}
            onOpenDetails={() => navigateToHash('score-details')}
          />
        </main>
        <BottomNav
          active={activePrimaryNav}
          onNavigate={navigatePrimary}
        />
      </>
    );
  }

  if (route.name === 'score-details') {
    return (
      <ScoreDetailsPage
        dailyScores={siteData.dailyScores}
        onBack={() => navigateToHash('leaderboard')}
      />
    );
  }

  if (route.name === 'games') {
    return (
      <>
        <main className="site-shell album-shell">
          <Hero team={siteData.team} showMedia={false} onVideoPlaybackChange={setHeroVideoPlaying} />
          <GamesPage games={siteData.games} />
        </main>
        <BottomNav active={activePrimaryNav} onNavigate={navigatePrimary} />
      </>
    );
  }

  if (route.name === 'album') {
    return (
      <>
        <main className="site-shell album-shell">
          <Hero team={siteData.team} showMedia={false} onVideoPlaybackChange={setHeroVideoPlaying} />
          <AlbumPage
            albums={siteData.albums}
            gallery={siteData.gallery}
            onOpenPhoto={openPhotoStream}
            resetKey={albumResetKey}
          />
          {viewer && (
            <MediaStreamViewer
              items={viewer.items}
              startIndex={viewer.startIndex}
              showActions={viewer.showActions}
              onClose={() => setViewer(null)}
            />
          )}
        </main>
        <BottomNav
          active={activePrimaryNav}
          onNavigate={navigatePrimary}
        />
      </>
    );
  }

  if (route.name === 'news' || route.name === 'news-detail') {
    return (
      <>
        <main className="site-shell album-shell">
          <Hero team={siteData.team} showMedia={false} onVideoPlaybackChange={setHeroVideoPlaying} />
          {route.name === 'news' ? (
            <NewsPage
              news={siteData.news}
              categories={siteData.newsCategories}
              onOpenItem={(item) => navigateToHash(`news/${encodeURIComponent(item.id)}`)}
            />
          ) : (
            <NewsDetailPage
              news={siteData.news}
              newsId={route.newsId}
              onBack={goBackFromNewsDetail}
            />
          )}
        </main>
        <BottomNav
          active={activePrimaryNav}
          onNavigate={navigatePrimary}
        />
      </>
    );
  }

  return (
    <>
      <main className="site-shell home-shell">
        <Hero team={siteData.team} onVideoPlaybackChange={setHeroVideoPlaying} />
        <StatsBar stats={siteData.stats} />
        <FeaturedMembers
          members={siteData.featuredMembers}
          onSelect={openMemberStream}
          paused={viewer !== null}
          sectionTitle={siteData.sectionTitles?.featured}
        />
        <Roster
          members={siteData.roster}
          onSelect={openMemberStream}
          sectionTitle={siteData.sectionTitles?.roster}
        />
        {viewer && (
          <MediaStreamViewer
            items={viewer.items}
            startIndex={viewer.startIndex}
            showActions={viewer.showActions}
            onClose={() => setViewer(null)}
          />
        )}
      </main>
      <MusicPlayer
        src={siteData.music.src}
        cover={siteData.music.cover}
        pauseForMedia={heroVideoPlaying || viewer !== null}
      />
      <BottomNav
        active={activePrimaryNav}
        onNavigate={navigatePrimary}
      />
    </>
  );
}
