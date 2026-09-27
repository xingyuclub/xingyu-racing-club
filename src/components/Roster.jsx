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

export function Roster({ members, onSelect = () => {}, sectionTitle }) {
  const eyebrow = sectionTitle?.eyebrow || 'STAR PLAYERS';
  const title = sectionTitle?.title || '明星队员';
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
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="roster-title">{title}</h2>
      </div>
      <div
        className="roster-dome"
        data-testid="roster-grid"
        aria-label={`${title}球形展示`}
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
