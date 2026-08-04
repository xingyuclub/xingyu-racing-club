import { useEffect, useState } from 'react';
import { createSeedConfig, hydrateSiteData } from './data/siteConfig.js';
import { Hero } from './components/Hero.jsx';
import { StatsBar } from './components/StatsBar.jsx';
import { FeaturedMembers } from './components/FeaturedMembers.jsx';
import { Roster } from './components/Roster.jsx';
import { Leaderboard } from './components/Leaderboard.jsx';
import { NewsFeed } from './components/NewsFeed.jsx';
import { VideoModal } from './components/VideoModal.jsx';
import { GalleryPreview } from './components/GalleryPreview.jsx';
import { AlbumPage } from './components/AlbumPage.jsx';
import { PhotoModal } from './components/PhotoModal.jsx';
import { ScoreDetailsModal } from './components/ScoreDetailsModal.jsx';
import { MusicPlayer } from './components/MusicPlayer.jsx';
import { useRevealOnScroll } from './hooks/useRevealOnScroll.js';
import { useSiteConfig } from './hooks/useSiteConfig.js';

const fallbackSiteData = hydrateSiteData(createSeedConfig());

export default function App() {
  const siteData = useSiteConfig(fallbackSiteData);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [showAlbum, setShowAlbum] = useState(() => window.location.hash === '#album');
  useRevealOnScroll(!showAlbum);

  useEffect(() => {
    const handleHashChange = () => setShowAlbum(window.location.hash === '#album');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openAlbum = () => {
    window.location.hash = 'album';
    setShowAlbum(true);
  };

  const closeAlbum = () => {
    window.location.hash = '';
    setShowAlbum(false);
  };

  if (showAlbum) {
    return (
      <>
        <main className="site-shell album-shell">
          <AlbumPage albums={siteData.albums} onBack={closeAlbum} onOpenPhoto={setSelectedPhoto} />
          <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
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
        <NewsFeed items={siteData.news} />
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
