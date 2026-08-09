import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSeedConfig, getHomeNews, hydrateSiteData } from './data/siteConfig.js';
import { Hero } from './components/Hero.jsx';
import { StatsBar } from './components/StatsBar.jsx';
import { FeaturedMembers } from './components/FeaturedMembers.jsx';
import { Roster } from './components/Roster.jsx';
import { Leaderboard } from './components/Leaderboard.jsx';
import { NewsFeed } from './components/NewsFeed.jsx';
import { NewsPage } from './components/NewsPage.jsx';
import { NewsDetailPage } from './components/NewsDetailPage.jsx';
import { MediaStreamViewer } from './components/MediaStreamViewer.jsx';
import { GalleryPreview } from './components/GalleryPreview.jsx';
import { AlbumPage } from './components/AlbumPage.jsx';
import { ScoreDetailsModal } from './components/ScoreDetailsModal.jsx';
import { MusicPlayer } from './components/MusicPlayer.jsx';
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
  return { name: 'home' };
};

export default function App() {
  const loadedSiteData = useSiteConfig(fallbackSiteData);
  const siteData = useMemo(() => resolvePublicAssetPaths(loadedSiteData), [loadedSiteData]);
  const [viewer, setViewer] = useState(null);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [heroVideoPlaying, setHeroVideoPlaying] = useState(false);
  const [route, setRoute] = useState(parseRoute);
  useRevealOnScroll(route.name === 'home');

  useEffect(() => {
    const handleHashChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [route.name, route.newsId]);

  const goHome = () => {
    window.location.hash = '';
    setRoute({ name: 'home' });
  };

  const openAlbum = () => {
    window.location.hash = 'album';
    setRoute({ name: 'album' });
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
    const withVideo = (siteData.roster || []).filter((candidate) => candidate.videoUrl);
    const startIndex = Math.max(0, withVideo.findIndex((candidate) => candidate.id === member.id));
    setViewer({
      items: withVideo.map(memberToStreamItem),
      startIndex,
      showActions: false,
    });
  }, [siteData.roster]);

  if (route.name === 'album') {
    return (
      <>
        <main className="site-shell album-shell">
          <Hero team={siteData.team} showMedia={false} onVideoPlaybackChange={setHeroVideoPlaying} />
          <AlbumPage albums={siteData.albums} onBack={goHome} onOpenPhoto={openPhotoStream} />
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
              onBack={goHome}
            />
          ) : (
            <NewsDetailPage news={siteData.news} newsId={route.newsId} />
          )}
        </main>
        <MusicPlayer
          src={siteData.music.src}
          cover={siteData.music.cover}
          pauseForMedia={heroVideoPlaying || viewer !== null}
        />
      </>
    );
  }

  return (
    <>
      <main className="site-shell">
        <Hero team={siteData.team} onVideoPlaybackChange={setHeroVideoPlaying} />
        <StatsBar stats={siteData.stats} />
        <FeaturedMembers
          members={siteData.featuredMembers}
          onSelect={openMemberStream}
          paused={viewer !== null}
        />
        <Roster members={siteData.roster} onSelect={openMemberStream} />
        <NewsFeed items={getHomeNews(siteData.news)} />
        <GalleryPreview
          photos={siteData.gallery}
          onOpenPhoto={openPhotoStream}
          onOpenAlbum={openAlbum}
        />
        <Leaderboard rows={siteData.leaderboard} scoreDate={siteData.latestScoreDate} onOpenDetails={() => setShowScoreDetails(true)} />
        {viewer && (
          <MediaStreamViewer
            items={viewer.items}
            startIndex={viewer.startIndex}
            showActions={viewer.showActions}
            onClose={() => setViewer(null)}
          />
        )}
        {showScoreDetails && (
          <ScoreDetailsModal
            dailyScores={siteData.dailyScores}
            onClose={() => setShowScoreDetails(false)}
          />
        )}
      </main>
      <MusicPlayer
        src={siteData.music.src}
        cover={siteData.music.cover}
        pauseForMedia={heroVideoPlaying || viewer !== null}
      />
    </>
  );
}
