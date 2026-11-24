// The coach: a 2D illustrated portrait of the player (curly hair with light
// tips, faded sides, thin mustache, stud earrings, silver chain, grey tee; the
// big shades come out when you nail it). Inline SVG: scales, no image files.
import { useId, type ReactNode } from 'react';
import { Explained } from './Explained';

export type Mood = 'neutral' | 'happy' | 'thinking' | 'concerned' | 'cool' | 'excited';

// Haircut (from the front reference): loose open coils with volume on top,
// falling onto the forehead and down the sides to the top of the ears; a low
// taper at the sideburns that fades to skin in front of the ears.
interface Curl { x: number; y: number; r: number; a: number; tip: boolean }
const inHair = (x: number, y: number) => {
  const dx = (x - 100) / 52, dy = (y - 50) / 30;
  if (dx * dx + dy * dy <= 1) {
    // fringe: uneven curls down to ~70 in the middle, the temples a bit higher
    const fringe = 70 - Math.abs(x - 100) * 0.08 + Math.sin(x / 4) * 2;
    return y <= fringe || Math.abs(x - 100) > 38;
  }
  // sides: curls falling to the top of the ears
  return y >= 50 && y <= 96 - Math.abs(y - 70) * 0.1 && ((x >= 50 && x <= 63) || (x >= 137 && x <= 150));
};
const CURLS: Curl[] = (() => {
  let s = 13;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out: Curl[] = [];
  for (let i = 0; i < 2400 && out.length < 170; i++) {
    const x = 46 + rnd() * 108, y = 18 + rnd() * 80;
    if (!inHair(x, y)) continue;
    out.push({ x, y, r: 3 + rnd() * 2.6, a: rnd() * 360, tip: y < 52 && rnd() < 0.6 });
  }
  return out.sort((p, q) => q.y - p.y);
})();
// Uneven outline of the hair (top and sides).
const RIM: [number, number, number][] = [
  ...Array.from({ length: 18 }, (_, i) => { const t = Math.PI * (1.0 + (i / 17) * 1.0); return [100 + Math.cos(t) * 52, 50 + Math.sin(t) * 30, 5 + (i % 3) * 1.4] as [number, number, number]; }),
  [50, 62, 6], [49, 74, 5.5], [51, 86, 5], [150, 62, 6], [151, 74, 5.5], [149, 86, 5],
];

export function CoachAvatar({ mood = 'neutral', size = 72, className = '' }: { mood?: Mood; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const u = (n: string) => `${n}-${id}`;
  const shades = mood === 'cool';
  // Brows (filled, tapered): [left, right]
  const browY = mood === 'excited' ? -4 : mood === 'concerned' ? 0 : 0;
  const browL = mood === 'concerned' ? 'M68 86 Q78 80 90 84 L90 87 Q79 84 69 89 Z'
    : mood === 'thinking' ? 'M68 87 Q78 83 90 86 L90 89 Q79 87 69 90 Z'
    : 'M67 87 Q78 81 91 85 L91 88 Q79 85 68 90 Z';
  const browR = mood === 'concerned' ? 'M110 84 Q122 80 132 86 L131 89 Q121 84 110 87 Z'
    : mood === 'thinking' ? 'M110 82 Q122 75 133 81 L132 84 Q121 79 110 85 Z'
    : 'M109 85 Q122 81 133 87 L132 90 Q121 85 109 88 Z';
  const lid = mood === 'happy' ? 2.5 : mood === 'concerned' ? 1 : mood === 'thinking' ? 1.5 : 0.5; // hooded, relaxed lids
  const lookX = mood === 'thinking' ? 3 : 0, lookY = mood === 'thinking' ? -1.5 : 0;
  const smile = mood === 'happy' || mood === 'excited';
  const mouth = mood === 'cool' ? { up: 'M84 141 Q92 138 100 139 Q108 138 116 141', low: 'M84 141 Q100 152 116 141 Q100 146 84 141 Z' }
    : mood === 'excited' ? { up: 'M83 140 Q100 136 117 140', low: 'M83 140 Q100 158 117 140 Z' }
    : mood === 'concerned' ? { up: 'M86 144 Q93 140 100 141 Q107 140 114 144', low: 'M86 144 Q100 149 114 144 Q100 145 86 144 Z' }
    : mood === 'thinking' ? { up: 'M86 143 Q94 140 100 141 Q108 139 115 140', low: 'M86 143 Q101 148 115 140 Q101 144 86 143 Z' }
    : { up: 'M85 142 Q93 139 100 140 Q107 139 115 142', low: 'M85 142 Q100 150 115 142 Q100 145 85 142 Z' };
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label="Your coach">
      <defs>
        <radialGradient id={u('bg')} cx="50%" cy="38%" r="70%"><stop offset="0" stopColor="#3a4150" /><stop offset="1" stopColor="#1d2129" /></radialGradient>
        <radialGradient id={u('skin')} cx="46%" cy="40%" r="62%"><stop offset="0" stopColor="#a06a48" /><stop offset="0.6" stopColor="#8a5638" /><stop offset="1" stopColor="#6a3f27" /></radialGradient>
        <linearGradient id={u('neck')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5e3722" /><stop offset="1" stopColor="#7f4e33" /></linearGradient>
        <linearGradient id={u('tee')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#64686d" /><stop offset="1" stopColor="#45484c" /></linearGradient>
        <radialGradient id={u('iris')} cx="40%" cy="40%" r="60%"><stop offset="0" stopColor="#6b4325" /><stop offset="1" stopColor="#24150c" /></radialGradient>
        <linearGradient id={u('lens')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a2a24" /><stop offset="0.55" stopColor="#120c0a" /><stop offset="1" stopColor="#2a1d18" /></linearGradient>
        <linearGradient id={u('lip')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6e3a2e" /><stop offset="1" stopColor="#8f5546" /></linearGradient>
        <linearGradient id={u('fade')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a120d" stopOpacity="0.92" /><stop offset="0.45" stopColor="#1a120d" stopOpacity="0.5" /><stop offset="0.8" stopColor="#1a120d" stopOpacity="0.12" /><stop offset="1" stopColor="#1a120d" stopOpacity="0" /></linearGradient>
        <clipPath id={u('clip')}><circle cx="100" cy="100" r="98" /></clipPath>
      </defs>
      <circle cx="100" cy="100" r="98" fill={`url(#${u('bg')})`} />
      <g clipPath={`url(#${u('clip')})`}>
        {/* shoulders + tee */}
        <path d="M14 200 Q20 168 62 160 L138 160 Q180 168 186 200 Z" fill={`url(#${u('tee')})`} />
        <path d="M58 172 Q40 180 34 200 M142 172 Q160 180 166 200" stroke="#3d4044" strokeWidth="1.5" fill="none" opacity="0.6" />
        {/* neck */}
        <path d="M80 140 L80 166 Q100 178 120 166 L120 140 Z" fill={`url(#${u('neck')})`} />
        <path d="M80 150 Q100 162 120 150 L120 140 L80 140 Z" fill="#4e2d1b" opacity="0.55" />
        {/* collar */}
        <path d="M74 162 Q100 184 126 162" stroke="#3f4246" strokeWidth="5" fill="none" />
        {/* chain */}
        <path d="M80 160 Q100 180 120 160" stroke="#c9ced4" strokeWidth="2.2" fill="none" strokeDasharray="2.6 1.4" />
        <path d="M80 160 Q100 180 120 160" stroke="#ffffff" strokeWidth="0.8" fill="none" strokeDasharray="1 3" opacity="0.8" />
        {/* ears */}
        <path d="M58 96 Q48 94 48 106 Q49 120 60 124 Z" fill="#7c4a2f" />
        <path d="M142 96 Q152 94 152 106 Q151 120 140 124 Z" fill="#7c4a2f" />
        <path d="M56 102 Q52 106 56 116" stroke="#5a321d" strokeWidth="1.5" fill="none" />
        <path d="M144 102 Q148 106 144 116" stroke="#5a321d" strokeWidth="1.5" fill="none" />
        <circle cx="54" cy="121" r="2.8" fill="#eef2f6" /><circle cx="53.2" cy="120.2" r="0.9" fill="#fff" />
        <circle cx="146" cy="121" r="2.8" fill="#eef2f6" /><circle cx="145.2" cy="120.2" r="0.9" fill="#fff" />
        {/* face */}
        <path d="M58 92 C58 62 76 50 100 50 C124 50 142 62 142 92 C142 118 136 134 125 146 C117 154 108 158 100 158 C92 158 83 154 75 146 C64 134 58 118 58 92 Z" fill={`url(#${u('skin')})`} />
        {/* cheek / jaw shading */}
        <path d="M60 104 Q64 136 84 152 Q70 136 66 108 Z" fill="#5c3520" opacity="0.35" />
        <path d="M140 104 Q136 136 116 152 Q130 136 134 108 Z" fill="#5c3520" opacity="0.35" />
        <ellipse cx="78" cy="114" rx="9" ry="5" fill="#b07656" opacity="0.25" />
        <ellipse cx="122" cy="114" rx="9" ry="5" fill="#b07656" opacity="0.25" />
        {/* forehead highlight */}
        <ellipse cx="98" cy="79" rx="16" ry="5" fill="#b88262" opacity="0.25" />
        {/* low taper: short at the sideburns, fading to skin in front of the ears */}
        <path d="M56 88 Q55 98 58 112 L63 112 Q62 100 63 90 Z" fill={`url(#${u('fade')})`} />
        <path d="M144 88 Q145 98 142 112 L137 112 Q138 100 137 90 Z" fill={`url(#${u('fade')})`} />
        {/* hair mass: top and the sides down to the ears */}
        <ellipse cx="100" cy="50" rx="50" ry="28" fill="#1a120d" />
        <path d="M50 52 Q46 72 52 96 L62 92 Q60 72 66 60 Z M150 52 Q154 72 148 96 L138 92 Q140 72 134 60 Z" fill="#1a120d" />
        <path d="M62 62 Q80 54 100 55 Q120 54 138 62 L136 70 Q120 66 100 67 Q80 66 64 70 Z" fill="#1a120d" />
        {RIM.map(([x, y, r], i) => <circle key={'r' + i} cx={x} cy={y} r={r} fill="#1a120d" />)}
        {CURLS.map((c, i) => (
          <g key={i} transform={`rotate(${c.a} ${c.x} ${c.y})`}>
            <path d={`M${c.x - c.r} ${c.y} a${c.r} ${c.r} 0 1 1 ${c.r * 1.7} ${c.r * 0.7} a${c.r * 0.6} ${c.r * 0.6} 0 1 1 ${-c.r * 0.9} ${-c.r * 0.6}`} fill="none" stroke="#2e2018" strokeWidth="2" strokeLinecap="round" />
            <path d={`M${c.x - c.r * 0.5} ${c.y - c.r * 0.8} a${c.r * 0.8} ${c.r * 0.8} 0 0 1 ${c.r * 1.1} ${c.r * 0.15}`} fill="none" stroke={c.tip ? '#9c7046' : '#4a3424'} strokeWidth="1.3" strokeLinecap="round" opacity={c.tip ? 0.9 : 0.75} />
          </g>
        ))}
        {/* loose coils hanging onto the forehead */}
        {[[78, 71, 3.6, 20], [92, 73, 4.2, -30], [104, 72, 3.4, 60], [119, 72, 3.8, -10]].map(([x, y, r, a], i) => (
          <path key={'h' + i} transform={`rotate(${a} ${x} ${y})`} d={`M${x - r} ${y - 3} q${r * 0.2} ${r * 1.6} ${r} ${r * 1.4} q${r * 0.9} ${-r * 0.3} ${r * 0.4} ${-r}`} fill="none" stroke="#1a120d" strokeWidth="2.2" strokeLinecap="round" />
        ))}
        {/* brows */}
        <g transform={`translate(0 ${browY})`}>
          <path d={browL} fill="#1d1410" />
          <path d={browR} fill="#1d1410" />
        </g>
        {shades ? (
          <g>
            <path d="M60 92 Q60 82 74 81 L92 82 Q99 84 100 90 Q101 84 108 82 L126 81 Q140 82 140 92 Q140 112 124 114 Q110 114 104 102 L96 102 Q90 114 76 114 Q60 112 60 92 Z" fill={`url(#${u('lens')})`} stroke="#0b0807" strokeWidth="2" />
            <path d="M60 90 L48 88 M140 90 L152 88" stroke="#f3f3f3" strokeWidth="5" strokeLinecap="round" />
            <path d="M68 88 Q74 84 84 85" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M112 85 Q120 84 128 87" stroke="#fff" strokeOpacity="0.25" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <rect x="74" y="94" width="5" height="7" rx="1" fill="#c9915e" opacity="0.5" />
            <rect x="118" y="94" width="5" height="7" rx="1" fill="#c9915e" opacity="0.5" />
          </g>
        ) : (
          <g>
            {[[79, 0], [121, 1]].map(([cx, k]) => (
              <g key={cx}>
                <path d={`M${cx - 12} 99 Q${cx} 90 ${cx + 12} 99 Q${cx} 105 ${cx - 12} 99 Z`} fill="#f3e9df" />
                <circle cx={cx + lookX + (k ? -1 : 1)} cy={99 + lookY} r="5" fill={`url(#${u('iris')})`} />
                <circle cx={cx + lookX + (k ? -1 : 1)} cy={99 + lookY} r="2.2" fill="#0d0805" />
                <circle cx={cx + lookX + (k ? -2.5 : -0.5)} cy={97.5 + lookY} r="1.2" fill="#fff" opacity="0.9" />
                {/* upper lid + hooding */}
                <path d={`M${cx - 13} 99 Q${cx} ${89 + lid} ${cx + 13} 99 L${cx + 13} 97 Q${cx} ${86 + lid} ${cx - 13} 97 Z`} fill="#6f4128" />
                <path d={`M${cx - 12.5} 99 Q${cx} ${90 + lid} ${cx + 12.5} 99`} stroke="#140c08" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d={`M${cx - 10} 101 Q${cx} 105.5 ${cx + 10} 101`} stroke="#4e2c19" strokeWidth="0.9" fill="none" />
                <path d={`M${cx - 9} 106 Q${cx} 109 ${cx + 9} 106`} stroke="#5c3520" strokeWidth="1" fill="none" opacity="0.5" />
              </g>
            ))}
          </g>
        )}
        {/* nose */}
        <path d="M95 100 Q93 114 89 121" stroke="#6a3d25" strokeWidth="1.6" fill="none" opacity="0.6" />
        <path d="M88 124 Q86 116 92 117 Q96 112 100 113 Q104 112 108 117 Q114 116 112 124 Q107 129 100 128 Q93 129 88 124 Z" fill="#7d4a2e" />
        <ellipse cx="100" cy="119" rx="5" ry="3.5" fill="#a86f4d" opacity="0.6" />
        <path d="M91 124 Q94 122 96 125 M104 125 Q106 122 109 124" stroke="#3d2214" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* lips */}
        {smile ? (
          <g>
            <path d="M84 139 Q100 135.5 116 139 Q112 152 100 153 Q88 152 84 139 Z" fill="#3a1712" />
            <path d="M85 140 Q100 137 115 140 L114 145 Q100 147 86 145 Z" fill="#f1ebe2" />
            <path d="M90 140.5 V145.5 M95 140 V146 M100 139.8 V146.3 M105 140 V146 M110 140.5 V145.5" stroke="#cfc4b6" strokeWidth="0.6" />
            <path d="M85 142.5 Q100 144 115 142.5" stroke="#b8b0a6" strokeWidth="0.9" fill="none" />
            <path d="M84 139 Q100 135.5 116 139" stroke="#6e3b2f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M86 150 Q100 157 114 150" stroke={`url(#${u('lip')})`} strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <path d={mouth.up + ' Q100 136 85 142 Z'} fill="#6e3b2f" stroke="#4a241b" strokeWidth="1.2" />
            <path d={mouth.low} fill={`url(#${u('lip')})`} />
          </g>
        )}
        {/* thin mustache + chin hair */}
        <path d="M83 137 Q85 132.5 92 131.5 Q100 132.5 108 131.5 Q115 132.5 117 137" stroke="#1d1410" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M86 136 Q92 133 99 134 M101 134 Q108 133 114 136" stroke="#0f0a07" strokeWidth="1" fill="none" opacity="0.8" />
        <path d="M95 152 Q100 155 105 152" stroke="#1d1410" strokeWidth="1.6" fill="none" opacity="0.45" strokeDasharray="1 1.2" />
      </g>
    </svg>
  );
}

/** The coach talking: avatar + speech bubble. */
export function CoachSays({ mood = 'neutral', children, text, size = 56, className = '' }: { mood?: Mood; children?: ReactNode; text?: string; size?: number; className?: string }) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <CoachAvatar mood={mood} size={size} className="shrink-0 drop-shadow" />
      <div className="relative min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-ink-800 px-3.5 py-2.5 text-sm leading-relaxed text-ink-100 ring-1 ring-ink-700">
        {text ? <Explained text={text} /> : children}
      </div>
    </div>
  );
}
