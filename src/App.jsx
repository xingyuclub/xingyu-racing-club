import { useEffect, useState } from 'react';
import { teamData } from './data/teamData.js';
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

export default function App() {
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
          <AlbumPage albums={teamData.albums} onBack={closeAlbum} onOpenPhoto={setSelectedPhoto} />
          <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
        </main>
        <MusicPlayer
          src="/audio/launch-now.mp3"
          cover="/images/music-avatar.png"
        />
      </>
    );
  }

  return (
    <>
      <main className="site-shell">
        <Hero team={teamData.team} />
        <StatsBar stats={teamData.stats} />
        <FeaturedMembers members={teamData.featuredMembers} onSelect={setSelectedMember} />
        <GalleryPreview
          photos={teamData.gallery}
          onOpenPhoto={setSelectedPhoto}
          onOpenAlbum={openAlbum}
        />
        <Roster members={teamData.roster} onSelect={setSelectedMember} />
        <Leaderboard rows={teamData.leaderboard} onOpenDetails={() => setShowScoreDetails(true)} />
        <NewsFeed items={teamData.news} />
        <VideoModal member={selectedMember} onClose={() => setSelectedMember(null)} />
        <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
        {showScoreDetails && (
          <ScoreDetailsModal
            dailyScores={teamData.dailyScores}
            onClose={() => setShowScoreDetails(false)}
          />
        )}
      </main>
      <MusicPlayer
        src="/audio/launch-now.mp3"
        cover="/images/music-avatar.png"
      />
    </>
  );
}
