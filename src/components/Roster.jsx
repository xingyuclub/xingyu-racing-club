import DomeGallery from './DomeGallery.jsx';

const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const TEAM_PREFIX = /^(?:ˣʸ༩)\s*[·._-]\s*/;

function displayName(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(INVISIBLE_CHARS, '')
    .trim()
    .replace(TEAM_PREFIX, '');
}

export function Roster({ members, onSelect = () => {} }) {
  const images = members.map((member) => ({
    src: member.avatarThumb || member.avatar || '',
    alt: `查看${member.name} 卡片详情`,
    label: displayName(member.name),
  }));

  const handleTileSelect = (srcIndex) => {
    const member = members[srcIndex];
    if (member?.videoUrl) onSelect(member);
  };

  return (
    <section
      className="section-block roster-section"
      aria-labelledby="roster-title"
      data-reveal
    >
      <div className="section-heading">
        <p className="eyebrow">FULL ROSTER</p>
        <h2 id="roster-title">队员阵容</h2>
      </div>
      <div
        className="roster-dome"
        data-testid="roster-grid"
        aria-label="队员阵容球形展示"
      >
        <DomeGallery
          images={images}
          fit={0.7}
          minRadius={500}
          maxRadius={900}
          overlayBlurColor="#0d1428"
          maxVerticalRotationDeg={8}
          segments={24}
          dragDampening={2.6}
          imageBorderRadius="30px"
          grayscale={false}
          onTileSelect={handleTileSelect}
        />
      </div>
    </section>
  );
}
