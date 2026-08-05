import { useEffect, useState } from 'react';
import { createSeedConfig, getHomeNews, hydrateSiteData } from './data/siteConfig.js';
import { Hero } from './components/Hero.jsx';
import { StatsBar } from './components/StatsBar.jsx';
import { FeaturedMembers } from './components/FeaturedMembers.jsx';
import { Roster } from './components/Roster.jsx';
import { Leaderboard } from './components/Leaderboard.jsx';
import { NewsFeed } from './components/NewsFeed.jsx';
import { NewsPage } from './components/NewsPage.jsx';
import { NewsDetailPage } from './components/NewsDetailPage.jsx';
import { VideoModal } from './components/VideoModal.jsx';
import { GalleryPreview } from './components/GalleryPreview.jsx';
import { AlbumPage } from './components/AlbumPage.jsx';
import { PhotoModal } from './components/PhotoModal.jsx';
import { ScoreDetailsModal } from './components/ScoreDetailsModal.jsx';
import { MusicPlayer } from './components/MusicPlayer.jsx';
import { useRevealOnScroll } from './hooks/useRevealOnScroll.js';
import { useSiteConfig } from './hooks/useSiteConfig.js';

const fallbackSiteData = hydrateSiteData(createSeedConfig());

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
  const siteData = useSiteConfig(fallbackSiteData);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [route, setRoute] = useState(parseRoute);
  useRevealOnScroll(route.name === 'home');

  useEffect(() => {
    const handleHashChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const goHome = () => {
    window.location.hash = '';
    setRoute({ name: 'home' });
  };

  const openAlbum = () => {
    window.location.hash = 'album';
    setRoute({ name: 'album' });
  };

  if (route.name === 'album') {
    return (
      <>
        <main className="site-shell album-shell">
          <AlbumPage albums={siteData.albums} onBack={goHome} onOpenPhoto={setSelectedPhoto} />
          <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
        </main>
        <MusicPlayer
          src={siteData.music.src}
          cover={siteData.music.cover}
        />
      </>
    );
  }

  if (route.name === 'news' || route.name === 'news-detail') {
    return (
      <>
        <main className="site-shell album-shell">
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
        />
      </>
    );
  }

  return (
    <>
      <main className="site-shell">
        <Hero team={siteData.team} />
        <StatsBar stats={siteData.stats} />
        <FeaturedMembers members={siteData.featuredMembers} onSelect={setSelectedMember} />
        <NewsFeed items={getHomeNews(siteData.news)} />
        <GalleryPreview
          photos={siteData.gallery}
          onOpenPhoto={setSelectedPhoto}
          onOpenAlbum={openAlbum}
        />
        <Roster members={siteData.roster} onSelect={setSelectedMember} />
        <Leaderboard rows={siteData.leaderboard} scoreDate={siteData.latestScoreDate} onOpenDetails={() => setShowScoreDetails(true)} />
        <VideoModal member={selectedMember} onClose={() => setSelectedMember(null)} />
        <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
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
      />
    </>
  );
}
