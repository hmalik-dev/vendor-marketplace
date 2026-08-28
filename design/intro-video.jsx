/* Orla — "Introducing Orla" launch film.
   Customer story first (demand is what makes the marketplace legible), then the
   same booking replayed from the vendor's side, then the double CTA.
   All choreography is keyed to T / CUES from useComposition(). */

const C = {
  clay: '#B4552F', clayT: '#A34A28', clayD: '#8E3F20', clay100: '#F7E7E0', clay50: '#FDF4EF',
  sage: '#5E6B4F', sageT: '#4B5940', sage50: '#EDF0E9', sage100: '#E4E9DE',
  gold: '#C99A2E', goldT: '#7A5A12', gold50: '#F5EEDC',
  steel: '#3D6A8C', steel50: '#EEF3FA',
  s0: '#FFFDF9', s50: '#F8F5EF', s100: '#F4F0E8', s150: '#F1ECE4', s200: '#EFE9E0',
  s300: '#E4DDD1', s400: '#D5CEC2', s600: '#6B6459', s700: '#4A443C', s900: '#23201C',
};
const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "'Instrument Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

/* Exactly three motion helpers — nothing eases outside these. */
const MOTION = {
  enter: (from, to, start, dur) => animate({ from, to, start, end: start + (dur || 0.7), ease: Easing.easeOutCubic }),
  draw: (from, to, start, dur) => animate({ from, to, start, end: start + (dur || 1.2), ease: Easing.easeInOutCubic }),
  pop: (from, to, start, dur) => animate({ from, to, start, end: start + (dur || 0.55), ease: Easing.easeOutBack }),
};

/* keyframe track: frames = [[t, ...values], ...] */
function kf(T, frames, ease) {
  const e = ease || Easing.easeInOutCubic;
  const first = frames[0], last = frames[frames.length - 1];
  if (T <= first[0]) return first.slice(1);
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i], b = frames[i + 1];
    if (T >= a[0] && T <= b[0]) {
      const p = b[0] === a[0] ? 1 : e((T - a[0]) / (b[0] - a[0]));
      const out = [];
      for (let j = 1; j < a.length; j++) out.push(a[j] + (b[j] - a[j]) * p);
      return out;
    }
  }
  return last.slice(1);
}

const DW = 1440, DH = 900, CT = 40; // device box, chrome height

/* ── small UI atoms (device space) ───────────────────────────────── */
const Mark = ({ size = 20, fill = C.clay, ring = C.s900, gap, style }) => {
  const g = gap == null ? size * 0.45 : gap;
  return (
    <div style={{ position: 'relative', width: size + g, height: size, ...style }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: '50%', background: fill }} />
      <div style={{ position: 'absolute', left: g, top: 0, width: size, height: size, borderRadius: '50%', border: Math.max(1.2, size * 0.075) + 'px solid ' + ring, boxSizing: 'border-box' }} />
    </div>
  );
};
const Pill = ({ bg, fg, children, style }) => (
  <span style={{ font: '700 11px ' + SANS, letterSpacing: '.07em', textTransform: 'uppercase', padding: '5px 10px', borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap', ...style }}>{children}</span>
);
const Btn = ({ children, kind = 'p', style }) => (
  <span style={{
    font: '600 15px ' + SANS, padding: '12px 22px', borderRadius: 10, display: 'inline-block', whiteSpace: 'nowrap',
    background: kind === 'p' ? C.clay : C.s0, color: kind === 'p' ? C.s0 : C.s900,
    border: kind === 'p' ? '1px solid ' + C.clay : '1px solid ' + C.s300, ...style,
  }}>{children}</span>
);
const Ph = ({ h, label, style }) => (
  <div style={{
    height: h, background: 'repeating-linear-gradient(135deg,#E6DFD3 0 9px,#EFE9DF 9px 18px)',
    display: 'flex', alignItems: 'flex-end', padding: 10, boxSizing: 'border-box', ...style,
  }}><span style={{ font: '400 10px ' + MONO, color: C.s600 }}>{label}</span></div>
);
const COVER_TONES = [
  ['#C9744C', '#8E3F20'], ['#5A6670', '#2C3238'], ['#D6A94E', '#A2761B'],
  ['#7A9468', '#49613D'], ['#C98A86', '#8E4E4A'], ['#A88C97', '#6B4A56'],
  ['#B4552F', '#6E2F17'], ['#8C7A63', '#4A3D2E'],
];
/* Composed cover art in the brand palette — stands in for photography
   without pretending to be a stock photo. */
const Cover = ({ h, i = 0, style }) => {
  const t = COVER_TONES[i % COVER_TONES.length];
  const a = (i % 3) * 14, b = (i % 4) * 11;
  return (
    <div style={{ position: 'relative', height: h, overflow: 'hidden', background: 'linear-gradient(152deg,' + t[0] + ' 0%,' + t[1] + ' 100%)', ...style }}>
      <div style={{ position: 'absolute', left: (-18 + a) + '%', top: (-30 + b) + '%', width: '78%', paddingBottom: '78%', borderRadius: '50%', background: 'radial-gradient(circle at 42% 38%, rgba(255,253,249,.22), rgba(255,253,249,0) 68%)' }} />
      <div style={{ position: 'absolute', right: (-22 + b) + '%', bottom: (-34 + a) + '%', width: '86%', paddingBottom: '86%', borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%, rgba(35,32,28,.26), rgba(35,32,28,0) 70%)' }} />
      <div style={{ position: 'absolute', left: (18 + b) + '%', top: (14 + a) + '%', width: '44%', paddingBottom: '44%', borderRadius: '50%', border: '1px solid rgba(255,253,249,.30)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%', background: 'linear-gradient(to top, rgba(35,32,28,.30), rgba(35,32,28,0))' }} />
    </div>
  );
};

const CoverImg = ({ src, h, i = 0, style }) => {
  const [ok, setOk] = React.useState(false);
  return (
    <div style={{ position: 'relative', height: h, overflow: 'hidden', ...style }}>
      <Cover h={h} i={i} style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }} />
      {src ? (
        <img src={src} alt="" onLoad={() => setOk(true)} onError={() => setOk(false)}
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: ok ? 1 : 0 }} />
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', background: 'linear-gradient(to top, rgba(35,32,28,.28), rgba(35,32,28,0))' }} />
    </div>
  );
};
const IMGS = (typeof window !== 'undefined' && window.OM_COVERS) || { categories: [], vendors: [] };

const Lbl = ({ children, style }) => (
  <div style={{ font: '600 11px ' + SANS, letterSpacing: '.05em', textTransform: 'uppercase', color: C.s600, ...style }}>{children}</div>
);
const Field = ({ label, value, w, style }) => (
  <div style={{ width: w, ...style }}>
    <Lbl style={{ marginBottom: 6 }}>{label}</Lbl>
    <div style={{ background: C.s0, border: '1px solid ' + C.s300, borderRadius: 10, padding: '11px 13px', font: '400 15px ' + SANS, color: value ? C.s900 : C.s400, height: 42, boxSizing: 'border-box' }}>{value || '—'}</div>
  </div>
);
const AppHeader = ({ vendor, right }) => (
  <div style={{ height: 60, borderBottom: '1px solid ' + C.s300, background: C.s0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Mark size={20} />
      <span style={{ font: '400 22px ' + SERIF, color: C.s900 }}>Orla</span>
      {vendor && <span style={{ font: '600 12px ' + SANS, letterSpacing: '.07em', textTransform: 'uppercase', color: C.s600, marginLeft: 6 }}>Vendor</span>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, font: '500 14px ' + SANS, color: C.s700 }}>{right}</div>
  </div>
);
const Avatar = ({ t = 'AN', sage, size = 32 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: sage ? C.sage100 : C.clay100, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 ' + Math.round(size * 0.42) + 'px ' + SERIF, color: sage ? C.sageT : C.clayD }}>{t}</div>
);

/* ── SECTION: opening + the fragmented "before" ─────────────────── */
function Opening({ T, CUES }) {
  const conv = MOTION.draw(0, 1, 0.15, 1.1)(T);
  const gap = 150 - 123.5 * conv;                       // circles glide together
  const wordO = MOTION.enter(0, 1, 0.95, 0.8)(T);
  const wordX = MOTION.enter(-26, 0, 0.95, 0.9)(T);
  const kicker = MOTION.enter(0, 1, 0.35, 0.7)(T);
  const out = T > CUES.Scatter ? MOTION.draw(1, 0, CUES.Scatter, 0.7)(T) : 1;
  const lift = T > CUES.Scatter ? MOTION.draw(0, -250, CUES.Scatter, 0.9)(T) : 0;
  const s = T > CUES.Scatter ? MOTION.draw(1, 0.42, CUES.Scatter, 0.9)(T) : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: out, transform: 'translateY(' + lift + 'px) scale(' + s + ')' }}>
      <div style={{ font: '500 15px ' + MONO, letterSpacing: '.34em', textTransform: 'uppercase', color: C.s600, opacity: kicker, marginBottom: 44 }}>Introducing</div>
      <div style={{ position: 'relative', width: 300, height: 118, marginBottom: 30 }}>
        <div style={{ position: 'absolute', left: 150 - gap - 59, top: 0, width: 118, height: 118, borderRadius: '50%', background: C.clay }} />
        <div style={{ position: 'absolute', left: 150 + gap - 59, top: 0, width: 118, height: 118, borderRadius: '50%', border: '4px solid ' + C.s900, boxSizing: 'border-box' }} />
      </div>
      <div style={{ font: '400 112px ' + SERIF, color: C.s900, lineHeight: 1, opacity: wordO, transform: 'translateY(' + wordX + 'px)', letterSpacing: '-.02em' }}>Orla</div>
    </div>
  );
}

const FRAGS = [
  { x: -430, y: -210, r: -7, w: 300, kind: 'tabs' },
  { x: 360, y: -250, r: 6, w: 280, kind: 'dm' },
  { x: -470, y: 130, r: 5, w: 300, kind: 'sheet' },
  { x: 400, y: 150, r: -6, w: 290, kind: 'dm2' },
  { x: -60, y: 250, r: 3, w: 320, kind: 'mail' },
];
function FragCard({ f, T, CUES }) {
  const inn = MOTION.enter(0, 1, CUES.Scatter + 0.15 + Math.abs(f.x) / 2600, 0.7)(T);
  const drift = Math.sin((T - CUES.Scatter) * 0.9 + f.x) * 9;
  const collapse = MOTION.draw(1, 0, CUES.Bridge + 0.15, 0.95)(T);
  const x = f.x * (0.55 + 0.45 * inn) * collapse;
  const y = f.y * (0.55 + 0.45 * inn) * collapse + drift;
  const body = {
    tabs: [['15 open tabs', C.s900], ['photographers austin', C.s600], ['austin wedding photo prices', C.s600], ['is $1,400 too much…', C.s600]],
    dm: [['Instagram DM', C.s900], ['hi! are you free June 14?', C.s600], ['seen · 3 days ago', C.s400]],
    sheet: [['vendors.xlsx', C.s900], ['col B — "maybe?"', C.s600], ['col C — no price', C.s600], ['col D — ???', C.s400]],
    dm2: [['Text message', C.s900], ['who was the caterer again', C.s600], ['delivered', C.s400]],
    mail: [['Inbox (4)', C.s900], ['Re: Re: Re: availability', C.s600], ['deposit — how much?', C.s600]],
  }[f.kind];
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', width: f.w, marginLeft: -f.w / 2, marginTop: -60,
      transform: 'translate(' + x + 'px,' + y + 'px) rotate(' + f.r + 'deg) scale(' + (0.9 + 0.1 * inn) * (0.7 + 0.3 * collapse) + ')',
      opacity: inn * collapse, background: C.s0, borderRadius: 12, border: '1px solid ' + C.s300,
      boxShadow: '0 12px 40px rgba(35,40,38,.16)', padding: '14px 16px',
    }}>
      {body.map((b, i) => (
        <div key={i} style={{ font: (i === 0 ? '600 14px ' : '400 13px ') + SANS, color: b[1], marginTop: i ? 7 : 0 }}>{b[0]}</div>
      ))}
    </div>
  );
}

/* ── the pivot: the mess collapses into one mark ─────────────────── */
function Bridge({ T, CUES }) {
  const pop = MOTION.pop(0, 1, CUES.Bridge + 0.35, 0.9)(T);
  const halo = MOTION.draw(0, 1, CUES.Bridge + 0.55, 1.6)(T);
  const out = T > CUES.Search - 0.55 ? MOTION.draw(1, 0, CUES.Search - 0.55, 0.5)(T) : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: out }}>
      <div style={{ position: 'absolute', width: 140 + halo * 700, height: 140 + halo * 700, borderRadius: '50%', border: '1px solid rgba(180,85,47,' + (0.4 * (1 - halo)) + ')' }} />
      <div style={{ position: 'absolute', width: 140 + halo * 380, height: 140 + halo * 380, borderRadius: '50%', border: '1px solid rgba(35,32,28,' + (0.22 * (1 - halo)) + ')' }} />
      <div style={{ transform: 'scale(' + pop + ')' }}><Mark size={98} gap={44} /></div>
    </div>
  );
}

/* ── the customer screens ────────────────────────────────────────── */
function SearchScreen({ T, CUES }) {
  const t0 = CUES.Search;
  const v1 = T > t0 + 0.9, v2 = T > t0 + 2.0, v3 = T > t0 + 3.1;
  const press = T > t0 + 4.45 && T < t0 + 4.8 ? 0.94 : 1;
  const seg = (label, value, on, w) => (
    <div style={{ width: w, padding: '0 22px', borderRight: '1px solid ' + C.s200 }}>
      <Lbl style={{ fontSize: 10 }}>{label}</Lbl>
      <div style={{ font: '500 17px ' + SANS, color: on ? C.s900 : C.s400, marginTop: 3 }}>{on ? value : 'Any'}</div>
    </div>
  );
  const cats = [['Photography', 'Photo & film'], ['Music', 'DJs, bands, hosts'], ['Catering', 'Food, bar, carts'], ['Venues', 'Halls & outdoor'], ['Florals', 'Bouquets & decor'], ['Beauty', 'Hair & makeup']];
  return (
    <div>
      <div style={{ height: 60, borderBottom: '1px solid ' + C.s300, background: C.s0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Mark size={21} gap={9} /><span style={{ font: '400 25px ' + SERIF, color: C.s900 }}>Orla</span></div>
          <div style={{ display: 'flex', gap: 24, font: '500 14px ' + SANS, color: C.s700 }}><span>Browse</span><span>How it works</span><span>For vendors</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ font: '500 14px ' + SANS, color: C.s700 }}>Sign in</span>
          <span style={{ font: '600 14px ' + SANS, color: C.s50, background: C.s900, borderRadius: 999, padding: '10px 18px' }}>Sign up</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 60, bottom: 0, background: 'linear-gradient(155deg,#F8F5EF 0%,#F7F0E8 52%,#F2E4D8 100%)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -130, top: -110, width: 440, height: 440, borderRadius: '50%', background: 'rgba(180,85,47,.06)' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 104, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(180,85,47,.1)', color: C.clayD, padding: '7px 14px', borderRadius: 999, font: '600 13px ' + SANS, marginBottom: 22 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.clay }} />Now booking in Austin
        </div>
        <div style={{ font: '400 58px ' + SERIF, color: C.s900, letterSpacing: '-.02em', lineHeight: 1.06 }}>
          Book your vendors<br /><em style={{ fontStyle: 'italic', color: C.clayT }}>without the back-and-forth.</em>
        </div>
        <div style={{ font: '400 18px/1.55 ' + SANS, color: C.s700, marginTop: 18, maxWidth: 740, marginLeft: 'auto', marginRight: 'auto' }}>Compare real availability and pricing from vendors near you, send one request, and pay securely once the date is locked in.</div>
      </div>
      <div style={{ position: 'absolute', left: 270, top: 376, width: 900, height: 84, background: C.s0, border: '1px solid ' + C.s300, borderRadius: 999, boxShadow: '0 8px 28px rgba(35,32,28,.10)', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
        {seg('Vendor type', 'Photography', v1, 300)}
        {seg('City', 'Austin, TX', v2, 260)}
        <div style={{ width: 240, padding: '0 22px' }}>
          <Lbl style={{ fontSize: 10 }}>Date</Lbl>
          <div style={{ font: '500 17px ' + SANS, color: v3 ? C.s900 : C.s400, marginTop: 3 }}>{v3 ? 'Jun 14, 2026' : 'Any date'}</div>
        </div>
        <div style={{ marginLeft: 'auto', marginRight: 9, background: C.clay, color: C.s0, font: '600 16px ' + SANS, padding: '16px 32px', borderRadius: 999, whiteSpace: 'nowrap', transform: 'scale(' + press + ')' }}>Search</div>
      </div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 500, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 20 }}>
        {cats.map((c, i) => {
          const o = MOTION.enter(0, 1, t0 + 0.5 + i * 0.13, 0.7)(T);
          return (
            <div key={i} style={{ background: C.s0, borderRadius: 16, boxShadow: '0 2px 10px rgba(35,32,28,.06)', overflow: 'hidden', opacity: o, transform: 'translateY(' + (1 - o) * 18 + 'px)' }}>
              <CoverImg h={104} i={i} src={IMGS.categories[i]} />
              <div style={{ padding: 14 }}>
                <div style={{ font: '400 21px ' + SERIF, color: C.s900 }}>{c[0]}</div>
                <div style={{ font: '400 13px ' + SANS, color: C.s600, marginTop: 3 }}>{c[1]}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const VENDORS = [
  ['June Harlow', '4.9', '127', 'Austin, TX', 'Free Jun 14', '$1,450'],
  ['Cardenas Studio', '4.8', '64', 'Austin, TX', 'Free Jun 14', '$1,200'],
  ['Wren & Field', '5.0', '18', 'Round Rock, TX', '2 dates left', '$980'],
  ['Bright Room Co.', '4.7', '92', 'Austin, TX', 'Free Jun 14', '$1,680'],
  ['Marlowe & Sons', '4.9', '41', 'Buda, TX', 'Free Jun 14', '$1,320'],
  ['Pomona Films', '4.8', '55', 'Austin, TX', '2 dates left', '$2,100'],
];
function CompactSearchBar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: C.s0, border: '1px solid ' + C.s300, borderRadius: 999, height: 46, padding: '0 6px 0 20px', boxShadow: '0 2px 10px rgba(35,32,28,.06)' }}>
      {[['Vendor type', 'Photography'], ['City', 'Austin, TX'], ['Date', 'Jun 14, 2026']].map((s, i) => (
        <div key={i} style={{ padding: '0 18px', borderRight: i < 2 ? '1px solid ' + C.s200 : 'none' }}>
          <div style={{ font: '600 9.5px ' + SANS, letterSpacing: '.05em', textTransform: 'uppercase', color: C.s600 }}>{s[0]}</div>
          <div style={{ font: '500 14px ' + SANS, color: C.s900 }}>{s[1]}</div>
        </div>
      ))}
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.clay, marginLeft: 10, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 12, height: 12, borderRadius: '50%', border: '1.8px solid ' + C.s0, boxSizing: 'border-box' }}>
          <div style={{ position: 'absolute', right: -4, bottom: -3, width: 6, height: 1.8, background: C.s0, borderRadius: 2, transform: 'rotate(45deg)' }} />
        </div>
      </div>
    </div>
  );
}
function ResultsScreen({ T, CUES }) {
  const t0 = CUES.Results;
  return (
    <div>
      <div style={{ height: 60, borderBottom: '1px solid ' + C.s300, background: C.s0, display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Mark size={19} /><span style={{ font: '400 21px ' + SERIF, color: C.s900 }}>Orla</span></div>
        <CompactSearchBar />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, font: '500 14px ' + SANS, color: C.s700 }}><span>Messages</span><Avatar /></div>
      </div>
      <div style={{ height: 52, borderBottom: '1px solid ' + C.s300, background: C.s0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 26px' }}>
        <Lbl>Refine</Lbl>
        {['Price', 'Style', 'Rating', 'Distance'].map((f) => (
          <span key={f} style={{ font: '500 13px ' + SANS, color: C.s900, border: '1px solid ' + C.s300, borderRadius: 8, padding: '7px 13px' }}>{f}</span>
        ))}
        <span style={{ font: '600 13px ' + SANS, color: C.clayD, background: C.clay100, border: '1px solid #EFD8CC', borderRadius: 8, padding: '7px 13px' }}>Free on Jun 14 ✕</span>
        <span style={{ marginLeft: 'auto', font: '400 14px ' + SANS, color: C.s600, whiteSpace: 'nowrap' }}>
          <span style={{ font: '400 20px ' + SERIF, color: C.s900 }}>18</span> photographers free that day
        </span>
      </div>
      <div style={{ position: 'absolute', left: 60, top: 140, display: 'grid', gridTemplateColumns: 'repeat(3, 420px)', gap: 30 }}>
        {VENDORS.map((v, i) => {
          const o = MOTION.enter(0, 1, t0 + 0.25 + i * 0.17, 0.7)(T);
          const sel = i === 0 && T > t0 + 4.7;
          return (
            <div key={i} style={{
              background: C.s0, borderRadius: 18, overflow: 'hidden', opacity: o,
              transform: 'translateY(' + (1 - o) * 26 + 'px) scale(' + (sel ? 1.015 : 1) + ')',
              boxShadow: sel ? '0 10px 30px rgba(35,32,28,.15)' : '0 2px 10px rgba(35,32,28,.06)',
            }}>
              <div style={{ position: 'relative' }}>
                <CoverImg h={280} i={[0, 6, 3, 5, 7, 1][i % 6]} src={IMGS.vendors[i]} />
                <div style={{ position: 'absolute', left: 16, bottom: -17 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid ' + C.s0, background: i % 2 ? C.sage100 : C.clay100, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 14px ' + SERIF, color: i % 2 ? C.sageT : C.clayD, boxSizing: 'border-box' }}>{v[0].split(' ')[0][0] + (v[0].split(' ')[1] || ' ')[0]}</div>
                </div>
              </div>
              <div style={{ padding: '22px 16px 16px' }}>
                <div style={{ font: '400 24px ' + SERIF, color: C.s900 }}>{v[0]}</div>
                <div style={{ font: '400 13.5px ' + SANS, color: C.s600, marginTop: 4 }}><b style={{ color: C.s700 }}>★ {v[1]}</b> ({v[2]}) · {v[3]}</div>
                <div style={{ marginTop: 11, display: 'flex', gap: 7 }}>
                  <Pill bg={C.s150} fg={C.s700}>Photography</Pill>
                  <Pill bg={v[4] === 'Free Jun 14' ? C.sage50 : C.gold50} fg={v[4] === 'Free Jun 14' ? C.sageT : C.goldT}>{v[4]}</Pill>
                </div>
                <div style={{ height: 1, background: C.s200, margin: '14px 0 11px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ font: '400 13px ' + SANS, color: C.s600 }}>From</span>
                  <span style={{ font: '700 20px ' + SANS, color: C.s900 }}>{v[5]}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RequestScreen({ T, CUES }) {
  const t0 = CUES.Request;
  const f1 = T > t0 + 0.7, f2 = T > t0 + 1.4, f3 = T > t0 + 2.1, f4 = T > t0 + 2.8;
  const typed = 'Outdoor ceremony at 5pm, reception until 11 — documentary style.';
  const n = Math.max(0, Math.round(MOTION.draw(0, typed.length, t0 + 2.8, 1.6)(T)));
  const press = T > t0 + 4.75 && T < t0 + 5.1 ? 0.96 : 1;
  return (
    <div>
      <AppHeader right={<><span>Browse</span><span>Messages</span><Avatar /></>} />
      <div style={{ padding: '26px 60px' }}>
        <div style={{ font: '400 34px ' + SERIF, color: C.s900 }}>Request a booking</div>
        <div style={{ font: '400 14px ' + SANS, color: C.s600, marginTop: 5 }}>June Harlow · Photography · Austin, TX</div>
      </div>
      <div style={{ position: 'absolute', left: 60, top: 160, display: 'grid', gridTemplateColumns: '340px 340px', gap: '20px 28px' }}>
        <Field label="Event date" value={f1 && 'Jun 14, 2026'} />
        <Field label="Event type" value={f2 && 'Wedding'} />
        <Field label="Guest count" value={f3 && '120'} />
        <Field label="Your phone" value={f4 && '(512) 555-0148'} />
        <Field label="Venue or address" value={f3 && 'Laguna Gloria · 3809 W 35th St'} />
        <Field label="Start time" value={f4 && '5:00 pm — 11:00 pm'} />
        <div style={{ gridColumn: '1 / -1' }}>
          <Lbl style={{ marginBottom: 6 }}>What you're planning</Lbl>
          <div style={{ background: C.s0, border: '1px solid ' + C.s300, borderRadius: 10, padding: '12px 13px', font: '400 15px/1.55 ' + SANS, color: C.s700, height: 92, boxSizing: 'border-box' }}>
            {typed.slice(0, n)}<span style={{ color: C.clay }}>{n < typed.length && n > 0 ? '|' : ''}</span>
          </div>
          <div style={{ font: '400 12.5px ' + SANS, color: C.s600, marginTop: 7 }}>{n} / 1000 · vendors reply faster to specific requests</div>
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center', background: C.sage50, border: '1px solid #C9D3BE', borderRadius: 12, padding: '13px 16px' }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: C.sage, flex: 'none' }} />
          <span style={{ font: '400 14px ' + SANS, color: C.sageT }}>June has Jun 14 open. She has 48 hours to reply, and you'll get an email either way.</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 830, top: 130, width: 400, background: C.s0, border: '1px solid ' + C.s300, borderRadius: 18, padding: 24, boxSizing: 'border-box' }}>
        <Lbl style={{ marginBottom: 14 }}>Requesting</Lbl>
        <div style={{ display: 'flex', gap: 14 }}>
          <CoverImg h={68} i={0} src={IMGS.vendors[0]} style={{ width: 68, flex: 'none', borderRadius: 10 }} />
          <div style={{ minWidth: 0, whiteSpace: 'nowrap' }}>
            <div style={{ font: '400 22px ' + SERIF, color: C.s900 }}>June Harlow</div>
            <div style={{ font: '400 13.5px ' + SANS, color: C.s600, marginTop: 3 }}><b style={{ color: C.s700 }}>★ 4.9</b> (127)</div>
          </div>
        </div>
        <div style={{ height: 1, background: C.s200, margin: '18px 0' }} />
        <div style={{ font: '400 15px/1.6 ' + SANS, color: C.s700 }}><b style={{ color: C.s900 }}>Full-day coverage</b><br />8 hours · 2 shooters · gallery in 4 weeks</div>
        <div style={{ font: '400 30px ' + SERIF, color: C.s900, marginTop: 14 }}>From $1,450</div>
        <div style={{ marginTop: 22, transform: 'scale(' + press + ')' }}><Btn style={{ width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>Send request</Btn></div>
        <div style={{ font: '400 13px/1.5 ' + SANS, color: C.s600, marginTop: 10, textAlign: 'center' }}>Sending doesn't charge you.</div>
      </div>
    </div>
  );
}

function QuoteScreen({ T, CUES }) {
  const t0 = CUES.Quote;
  const q = MOTION.enter(0, 1, t0 + 1.5, 0.8)(T);
  const accept = T > t0 + 4.0;
  const press = T > t0 + 3.8 && T < t0 + 4.15 ? 0.96 : 1;
  const paid = MOTION.enter(0, 1, t0 + 4.3, 0.7)(T);
  return (
    <div>
      <AppHeader right={<><span>Browse</span><Avatar /></>} />
      <div style={{ position: 'absolute', left: 0, top: 60, width: 260, bottom: 0, background: C.s0, borderRight: '1px solid ' + C.s300, padding: '14px 0' }}>
        {[['JH', 'June Harlow', 'Quote attached — $1,750', true], ['MC', 'Mesa Catering', 'Can you do 140 plated?', false], ['TL', 'Travis Loft', 'Walkthrough on the 3rd?', false]].map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '12px 16px', background: r[3] ? C.clay100 : 'transparent' }}>
            <Avatar t={r[0]} sage={i % 2 === 0} size={34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: (r[3] ? '600 14px ' : '500 14px ') + SANS, color: C.s900 }}>{r[1]}</div>
              <div style={{ font: '400 12.5px ' + SANS, color: C.s600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: 168 }}>{r[2]}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', right: 0, top: 60, width: 320, bottom: 0, background: C.s0, borderLeft: '1px solid ' + C.s300, padding: 22, boxSizing: 'border-box' }}>
        <Lbl style={{ marginBottom: 12 }}>This booking</Lbl>
        <div style={{ font: '400 26px ' + SERIF, color: C.s900 }}>Jun 14, 2026</div>
        <div style={{ font: '400 13.5px ' + SANS, color: C.s600, marginTop: 5 }}>Wedding · 120 guests · Austin, TX</div>
        <div style={{ marginTop: 12 }}>{accept ? <Pill bg={C.sage50} fg={C.sageT}>Confirmed</Pill> : <Pill bg={C.steel50} fg={C.steel}>Quoted</Pill>}</div>
        <div style={{ height: 1, background: C.s200, margin: '18px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', font: '400 14px ' + SANS, color: C.s700 }}><span>Full-day coverage</span><b style={{ color: C.s900 }}>$1,450</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', font: '400 14px ' + SANS, color: C.s700, marginTop: 9 }}><span>Second shooter</span><b style={{ color: C.s900 }}>$300</b></div>
        <div style={{ height: 1, background: C.s200, margin: '18px 0' }} />
        <div style={{ font: '400 34px ' + SERIF, color: C.s900 }}>$1,750</div>
        <div style={{ font: '400 13px/1.6 ' + SANS, color: C.s600, marginTop: 6 }}>Held until the event. June is paid the day after Jun 14.</div>
      </div>
      <div style={{ position: 'absolute', left: 260, top: 60, right: 320, bottom: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 64, borderBottom: '1px solid ' + C.s300, background: C.s0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 26px' }}>
          <Avatar t="JH" sage size={38} />
          <div>
            <div style={{ font: '600 15px ' + SANS, color: C.s900 }}>June Harlow</div>
            <div style={{ font: '400 12.5px ' + SANS, color: C.s600 }}>Photography · Austin, TX</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>{accept ? <Pill bg={C.sage50} fg={C.sageT}>Confirmed</Pill> : <Pill bg={C.steel50} fg={C.steel}>Quoted</Pill>}</div>
        </div>
        <div style={{ flex: 1, padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'flex-end' }}>
          <div style={{ alignSelf: 'flex-start', maxWidth: 460, background: C.s0, border: '1px solid ' + C.s300, borderRadius: 16, padding: '13px 17px', font: '400 15px/1.6 ' + SANS, color: C.s900 }}>Hi Anjali — thanks for the request. Jun 14 is still open on my side.</div>
          <div style={{ alignSelf: 'flex-end', maxWidth: 460, background: C.clay100, borderRadius: 16, padding: '13px 17px', font: '400 15px/1.6 ' + SANS, color: C.s900 }}>Wonderful. Outdoor ceremony, reception until 11 — could you send a price?</div>
          <div style={{ alignSelf: 'flex-end', maxWidth: 460, background: C.clay100, borderRadius: 16, padding: '13px 17px', font: '400 15px/1.6 ' + SANS, color: C.s900 }}>Full day, ceremony at 5pm — 120 guests.</div>
          <div style={{ alignSelf: 'flex-start', maxWidth: 460, background: C.s0, border: '1px solid ' + C.s300, borderRadius: 16, padding: '13px 17px', font: '400 15px/1.6 ' + SANS, color: C.s900 }}>Jun 14 is open. Sending you a quote now.</div>
          <div style={{ alignSelf: 'flex-start', width: 470, background: C.s0, border: '1px solid ' + C.s300, borderRadius: 16, boxShadow: '0 8px 28px rgba(35,32,28,.10)', padding: 20, opacity: q, transform: 'translateY(' + (1 - q) * 22 + 'px)' }}>
            <Lbl style={{ marginBottom: 10 }}>Quote · valid 7 days</Lbl>
            {[['Full-day coverage', '$1,450'], ['Second shooter', '$300']].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, whiteSpace: 'nowrap', font: '400 14.5px ' + SANS, color: C.s700, marginTop: i ? 9 : 0 }}>
                <span>{r[0]}</span><b style={{ color: C.s900 }}>{r[1]}</b>
              </div>
            ))}
            <div style={{ height: 1, background: C.s200, margin: '14px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ font: '600 14px ' + SANS, color: C.s900 }}>Total</span>
              <span style={{ font: '400 34px ' + SERIF, color: C.s900 }}>$1,750</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center', transform: 'scale(' + press + ')', transformOrigin: 'left center' }}>
              <Btn>{accept ? 'Paid — held' : 'Accept & pay'}</Btn>
              <span style={{ font: '400 13px ' + SANS, color: C.s600 }}>Held until Jun 14</span>
            </div>
          </div>
          <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 10, opacity: paid }}>
            <Pill bg={C.sage50} fg={C.sageT}>Payment held</Pill>
            <Pill bg={C.sage50} fg={C.sageT}>The price you were quoted</Pill>
            <Pill bg={C.sage50} fg={C.sageT}>Paid out after the event</Pill>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmedScreen({ T, CUES }) {
  const t0 = CUES.Confirmed;
  const ring = MOTION.pop(0, 1, t0 + 0.2, 0.8)(T);
  const line = MOTION.enter(0, 1, t0 + 0.65, 0.8)(T);
  const meta = MOTION.enter(0, 1, t0 + 1.35, 0.8)(T);
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg,#7A9468 0%,#5E7A4E 55%,#49613D 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -120, top: -110, width: 420, height: 420, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
      <div style={{ position: 'absolute', right: -160, bottom: -170, width: 520, height: 520, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
      <div style={{ width: 84, height: 84, borderRadius: '50%', border: '3px solid rgba(255,253,249,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(' + ring + ')', marginBottom: 34 }}>
        <div style={{ width: 30, height: 16, borderLeft: '3px solid #FFFDF9', borderBottom: '3px solid #FFFDF9', transform: 'rotate(-45deg) translateY(-3px)' }} />
      </div>
      <div style={{ font: '400 66px ' + SERIF, color: '#FFFDF9', letterSpacing: '-.02em', opacity: line, transform: 'translateY(' + (1 - line) * 16 + 'px)' }}>Jun 14 is booked</div>
      <div style={{ font: '400 20px ' + SANS, color: 'rgba(255,253,249,.9)', marginTop: 16, opacity: meta }}>June Harlow · full-day coverage · $1,750 held until the event</div>
      <div style={{ font: '400 14px ' + MONO, letterSpacing: '.14em', color: 'rgba(255,253,249,.88)', marginTop: 30, opacity: meta }}>BK-2026-0614-JH</div>
    </div>
  );
}

/* ── the vendor side ─────────────────────────────────────────────── */
function VendorScreen({ T, CUES }) {
  const t0 = CUES.VendorDay;
  const arrive = MOTION.pop(0, 1, CUES.Flip + 1.5, 0.85)(T);
  const quoted = T > t0 + 2.6;
  const pressQ = T > t0 + 2.4 && T < t0 + 2.75 ? 0.96 : 1;
  const blocked = MOTION.enter(0, 1, t0 + 3.8, 0.8)(T);
  const payout = MOTION.enter(0, 1, t0 + 4.2, 0.9)(T);
  const days = ['12', '13', '14', '15', '16', '17', '18'];
  return (
    <div>
      <AppHeader vendor right={<><span>Requests</span><span>Availability</span><Avatar t="JH" sage /></>} />
      <div style={{ position: 'absolute', left: 0, top: 60, width: 220, bottom: 0, background: C.s0, borderRight: '1px solid ' + C.s300, padding: '18px 12px' }}>
        <Lbl style={{ padding: '0 10px 12px' }}>Vending</Lbl>
        {[['Dashboard', true], ['Requests', false], ['Messages', false], ['Availability', false], ['My profile', false], ['Payouts', false]].map((n, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: 9, font: (n[1] ? '600 14px ' : '500 14px ') + SANS,
            color: n[1] ? C.clayD : C.s700, background: n[1] ? C.clay100 : 'transparent', boxShadow: n[1] ? 'inset 3px 0 0 ' + C.clay : 'none',
          }}>{n[0]}{i === 1 && <span style={{ marginLeft: 'auto', font: '700 11px ' + SANS, color: C.s0, background: C.clay, borderRadius: 999, padding: '2px 8px' }}>1</span>}</div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 220, top: 60, right: 0, bottom: 0, padding: '24px 30px' }}>
        <div style={{ font: '400 30px ' + SERIF, color: C.s900 }}>Good morning, June</div>
        <div style={{ font: '400 14px ' + SANS, color: C.s600, marginTop: 4, marginBottom: 20 }}>One new request · 3 confirmed events this month</div>
        <div style={{
          width: 700, background: C.s0, border: '1px solid ' + C.s300, borderRadius: 18, padding: 22,
          boxShadow: '0 10px 30px rgba(35,32,28,.12)', transform: 'scale(' + (0.94 + 0.06 * arrive) + ')', opacity: arrive, transformOrigin: 'left top',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {quoted ? <Pill bg={C.steel50} fg={C.steel}>Quoted</Pill> : <Pill bg={C.clay100} fg={C.clayD}>Needs you</Pill>}
            <span style={{ font: '400 13.5px ' + SANS, color: C.s600 }}>Received 2 minutes ago</span>
          </div>
          <div style={{ font: '400 26px ' + SERIF, color: C.s900, marginTop: 12 }}>Wedding · Jun 14, 2026 · 120 guests</div>
          <div style={{ font: '400 15px/1.6 ' + SANS, color: C.s700, marginTop: 8 }}>Anjali N. · Austin, TX · outdoor ceremony at 5pm, reception until 11.</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 18, alignItems: 'center', transform: 'scale(' + pressQ + ')', transformOrigin: 'left center' }}>
            <Btn>{quoted ? 'Quote sent · $1,750' : 'Send a quote'}</Btn>
            <Btn kind="s">Message Anjali</Btn>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 26 }}>
          <div style={{ width: 430, background: C.s0, border: '1px solid ' + C.s300, borderRadius: 18, padding: 20, boxSizing: 'border-box' }}>
            <Lbl style={{ marginBottom: 14 }}>June 2026 · your calendar</Lbl>
            <div style={{ display: 'flex', gap: 8 }}>
              {days.map((d, i) => {
                const isTarget = d === '14';
                const on = isTarget ? blocked : (i === 1 || i === 5 ? 1 : 0);
                return (
                  <div key={d} style={{
                    width: 50, height: 62, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: on > 0.5 ? C.sage50 : C.s150, border: '1px solid ' + (on > 0.5 ? '#C9D3BE' : C.s300),
                    transform: 'scale(' + (isTarget ? 0.9 + 0.1 * blocked : 1) + ')',
                  }}>
                    <span style={{ font: '400 20px ' + SERIF, color: on > 0.5 ? C.sageT : C.s700 }}>{d}</span>
                    <span style={{ font: '600 9px ' + SANS, letterSpacing: '.06em', textTransform: 'uppercase', color: on > 0.5 ? C.sageT : C.s600, marginTop: 3 }}>{on > 0.5 ? 'Booked' : 'Open'}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ font: '400 13px ' + SANS, color: C.s600, marginTop: 14 }}>Accepted bookings block the date automatically.</div>
          </div>
          <div style={{ width: 430, background: C.s0, border: '1px solid ' + C.s300, borderRadius: 18, padding: 20, boxSizing: 'border-box', opacity: payout, transform: 'translateY(' + (1 - payout) * 14 + 'px)' }}>
            <Lbl style={{ marginBottom: 14 }}>Payouts</Lbl>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ font: '400 34px ' + SERIF, color: C.s900 }}>$1,750</div>
                <div style={{ font: '400 13.5px ' + SANS, color: C.s600, marginTop: 4 }}>Anjali N. · Jun 14 wedding</div>
              </div>
              <div style={{ transform: 'translateY(' + (1 - payout) * 10 + 'px)' }}><Pill bg={C.sage50} fg={C.sageT}>Pays out Jun 15</Pill></div>
            </div>
            <div style={{ height: 1, background: C.s200, margin: '16px 0' }} />
            <div style={{ font: '400 14px/1.6 ' + SANS, color: C.s700 }}>Held by Orla until the event, then straight to your account — <b style={{ color: C.s900 }}>the day after Jun 14.</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── close ───────────────────────────────────────────────────────── */
function Close({ T, CUES, total }) {
  const t0 = CUES.Close;
  const mark = MOTION.pop(0, 1, t0 - 0.35, 0.8)(T);
  const word = MOTION.enter(0, 1, t0 - 0.2, 0.8)(T);
  const tag = MOTION.enter(0, 1, t0 + 0.35, 0.8)(T);
  const cta = MOTION.enter(0, 1, t0 + 1.0, 0.8)(T);
  const url = MOTION.enter(0, 1, t0 + 1.6, 0.8)(T);
  const drift = MOTION.draw(0, -14, t0 - 0.35, total - t0)(T);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: 'translateY(' + drift + 'px)' }}>
      <div style={{ transform: 'scale(' + mark + ')', marginBottom: 28 }}><Mark size={92} gap={42} /></div>
      <div style={{ font: '400 104px ' + SERIF, color: C.s900, lineHeight: 1, letterSpacing: '-.02em', opacity: word, transform: 'translateY(' + (1 - word) * 18 + 'px)' }}>Orla</div>
      <div style={{ font: '400 30px/1.45 ' + SANS, color: C.s700, marginTop: 22, opacity: tag, textAlign: 'center' }}>Clear prices. Open calendars.<br />No back-and-forth.</div>
      <div style={{ display: 'flex', gap: 16, marginTop: 40, opacity: cta, transform: 'translateY(' + (1 - cta) * 14 + 'px)' }}>
        <span style={{ font: '600 19px ' + SANS, color: C.s0, background: C.clay, borderRadius: 999, padding: '17px 34px', whiteSpace: 'nowrap' }}>Find a vendor</span>
        <span style={{ font: '600 19px ' + SANS, color: C.s50, background: C.s900, borderRadius: 999, padding: '17px 34px', whiteSpace: 'nowrap' }}>Join as a vendor</span>
      </div>
      <div style={{ font: '500 16px ' + MONO, letterSpacing: '.3em', textTransform: 'uppercase', color: C.s600, marginTop: 46, opacity: url }}>orla.com</div>
    </div>
  );
}

/* ── audio ──────────────────────────────────────────────────────── */
const AUDIO = (typeof window !== 'undefined' && window.OM_AUDIO) || {};
// Preview-only. The frame exporter paints the DOM per frame and writes no audio
// track, so the soundtrack is muxed onto the exported file afterwards — see
// design-plan/41-film-audio.md.
function AudioTrack({ src, T, playing, volume = 1, total }) {
  const ref = React.useRef(null);
  const last = React.useRef(-1);
  const idle = React.useRef(null);
  // Playback is inferred from the authored clock MOVING, not from the stage's
  // `playing` flag: the host timeline drives playback by dispatching a seek per
  // frame, and during that the flag can read false. Motion is the truth.
  React.useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    if (v.volume !== volume) v.volume = volume;
    const prev = last.current;
    last.current = T;
    const dt = T - prev;
    const first = prev < 0;
    const stepping = !first && dt > 0 && dt < 0.5;      // ordinary playback
    const jumped = first || dt < 0 || Math.abs(dt) >= 0.5;
    const target = Math.max(0, Math.min(T, (total || 56) - 0.05));
    if (jumped && Math.abs(v.currentTime - target) > 0.12) {
      try { v.currentTime = target; } catch (e) {}
    } else if (stepping && Math.abs(v.currentTime - target) > 1.2) {
      try { v.currentTime = target; } catch (e) {}      // slow drift only
    }
    const shouldPlay = stepping || playing;
    if (shouldPlay) {
      if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      // if no further frame arrives, playback stopped — park the audio
      if (idle.current) clearTimeout(idle.current);
      idle.current = setTimeout(() => { if (!v.paused) v.pause(); }, 300);
    } else if (!playing && !v.paused && !stepping) {
      v.pause();
    }
  });
  React.useEffect(() => () => { if (idle.current) clearTimeout(idle.current); }, []);
  if (!src) return null;
  return (
    <video ref={ref} src={src} playsInline preload="auto"
           style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 2, opacity: 0.01, pointerEvents: 'none' }} />
  );
}

/* ── cursor ──────────────────────────────────────────────────────── */
function Cursor({ x, y, on, click }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: on, transform: 'translate(-3px,-2px)', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: -26, top: -26, width: 52, height: 52, borderRadius: '50%', border: '2px solid ' + C.clay, opacity: click * 0.7, transform: 'scale(' + (0.4 + click * 0.9) + ')' }} />
      <div style={{
        width: 0, height: 0, borderLeft: '11px solid ' + C.s900, borderRight: '9px solid transparent',
        borderBottom: '16px solid transparent', borderTop: '0 solid transparent',
        transform: 'rotate(-14deg)', filter: 'drop-shadow(0 2px 4px rgba(35,32,28,.35))',
      }} />
      <div style={{ position: 'absolute', left: 3, top: 3, width: 0, height: 0, borderLeft: '7px solid ' + C.s0, borderRight: '5px solid transparent', borderBottom: '10px solid transparent', transform: 'rotate(-14deg)' }} />
    </div>
  );
}

/* ── the one composition ─────────────────────────────────────────── */
function OrlaIntro(props) {
  const { T, CUES, authoredTotal, playing } = useComposition();
  const showCaptions = props.captions !== false;
  const showCursor = props.cursor !== false;
  const total = authoredTotal || 38;

  // camera: [t, focusX, focusY, scale] in device space
  const [fx, fy, sc] = kf(T, [
    [CUES.Search - 0.7, 720, 470, 1.0],
    [CUES.Search + 0.5, 720, 445, 1.32],
    [CUES.Search + 5.8, 720, 450, 1.4],
    [CUES.Results + 0.3, 720, 470, 1.02],
    [CUES.Results + 3.6, 720, 470, 1.05],
    [CUES.Results + 6.0, 330, 420, 1.5],
    [CUES.Request + 0.6, 700, 400, 1.14],
    [CUES.Request + 4.6, 740, 470, 1.2],
    [CUES.Quote + 0.9, 720, 500, 1.26],
    [CUES.Quote + 5.4, 700, 540, 1.32],
    [CUES.Confirmed + 0.3, 720, 470, 1.0],
    [CUES.Flip + 2.8, 720, 470, 1.03],
    [CUES.VendorDay + 0.9, 700, 370, 1.26],
    [CUES.VendorDay + 4.9, 710, 545, 1.18],
    [CUES.VendorDay + 6.8, 720, 470, 1.02],
    [CUES.Close - 0.4, 720, 470, 1.06],
  ]);
  const camX = -(fx - DW / 2) * sc, camY = -(fy - DH / 2) * sc;

  // cursor path (device space) + click pulses
  const [cx, cy] = kf(T, [
    [CUES.Search + 0.3, 980, 700],
    [CUES.Search + 0.85, 420, 456],
    [CUES.Search + 2.0, 700, 456],
    [CUES.Search + 3.1, 930, 456],
    [CUES.Search + 4.4, 1150, 458],
    [CUES.Results + 0.5, 1150, 700],
    [CUES.Results + 4.6, 250, 420],
    [CUES.Results + 6.2, 250, 420],
    [CUES.Request + 0.8, 300, 300],
    [CUES.Request + 2.8, 420, 470],
    [CUES.Request + 4.7, 1030, 660],
    [CUES.Quote + 0.6, 900, 700],
    [CUES.Quote + 3.7, 640, 700],
    [CUES.Quote + 5.0, 800, 760],
    [CUES.Confirmed - 0.3, 800, 900],
    [CUES.VendorDay + 2.0, 480, 700],
    [CUES.VendorDay + 2.45, 420, 458],
    [CUES.VendorDay + 3.8, 700, 640],
    [CUES.VendorDay + 6.4, 1000, 700],
    [CUES.Close - 0.5, 1200, 940],
  ], Easing.easeInOutQuart);
  const clicks = [CUES.Search + 4.5, CUES.Results + 6.2, CUES.Request + 4.85, CUES.Quote + 3.85, CUES.VendorDay + 2.5];
  let click = 0;
  clicks.forEach((c) => { if (T >= c && T < c + 0.45) click = Math.max(click, 1 - (T - c) / 0.45); });
  const cursorOn = (showCursor ? 1 : 0) * MOTION.enter(0, 1, CUES.Search + 0.2, 0.5)(T) * (T > CUES.Confirmed - 0.4 && T < CUES.VendorDay + 1.4 ? 0 : 1) * (T > CUES.Close - 0.6 ? MOTION.draw(1, 0, CUES.Close - 0.6, 0.5)(T) : 1);

  // device presence
  const devIn = MOTION.enter(0, 1, CUES.Search - 0.9, 1.0)(T);
  const devOut = T > CUES.Close - 0.5 ? MOTION.draw(1, 0, CUES.Close - 0.5, 0.7)(T) : 1;
  const devO = devIn * devOut;
  const devLift = (1 - devIn) * 130;

  // flip: customer screen lifts out, vendor screen rises in
  const flip = MOTION.draw(0, 1, CUES.Flip + 0.7, 1.0)(T);
  const bgDrift = Math.sin(T * 0.22) * 26;

  return (
    <div data-screen-label={'Introducing Orla · t=' + Math.floor(T) + 's'} style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#EFEAE1 0%,#E9E4DA 46%,#E2DCD1 100%)', overflow: 'hidden', fontFamily: SANS }}>
      <div style={{ position: 'absolute', left: -240 + bgDrift, top: -180, width: 760, height: 760, borderRadius: '50%', background: 'radial-gradient(circle at 40% 40%, rgba(180,85,47,.10), rgba(180,85,47,0) 70%)' }} />
      <div style={{ position: 'absolute', right: -300 - bgDrift, bottom: -260, width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%, rgba(94,107,79,.10), rgba(94,107,79,0) 70%)' }} />

      <AudioTrack src={AUDIO.music} T={T} playing={playing} volume={AUDIO.musicVolume == null ? 0.65 : AUDIO.musicVolume} total={total} />
      <AudioTrack src={AUDIO.voice} T={T} playing={playing} volume={AUDIO.voiceVolume == null ? 1 : AUDIO.voiceVolume} total={total} />

      <Shot from={0} to={CUES.Search + 0.4}><Opening T={T} CUES={CUES} /></Shot>
      <Shot from={CUES.Scatter} to={CUES.Bridge + 1.4}>
        {FRAGS.map((f, i) => <FragCard key={i} f={f} T={T} CUES={CUES} />)}
      </Shot>
      <Shot from={CUES.Bridge - 0.2} to={CUES.Search + 0.6}><Bridge T={T} CUES={CUES} /></Shot>

      {/* the device — one element from Search through Close */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: DW, height: DH, marginLeft: -DW / 2, marginTop: -DH / 2 - 30, opacity: devO }}>
        <div style={{ position: 'absolute', inset: 0, transform: 'translate(' + camX + 'px,' + (camY + devLift) + 'px) scale(' + sc * (0.94 + 0.06 * devIn) * (0.86 + 0.14 * devOut) + ')' }}>
          <div style={{ position: 'absolute', inset: 0, background: C.s50, borderRadius: 18, overflow: 'hidden', boxShadow: '0 30px 90px rgba(35,32,28,.22), 0 2px 0 rgba(255,255,255,.5) inset' }}>
            <div style={{ height: CT, background: C.s100, borderBottom: '1px solid ' + C.s300, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
              {[C.s400, C.s400, C.s400].map((d, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: d }} />)}
              <div style={{ marginLeft: 16, background: C.s0, border: '1px solid ' + C.s300, borderRadius: 999, padding: '4px 16px', font: '400 12px ' + MONO, color: C.s600 }}>orla.com</div>
            </div>
            <div style={{ position: 'absolute', left: 0, top: CT, right: 0, bottom: 0, overflow: 'hidden' }}>
              {/* customer layer */}
              <div style={{ position: 'absolute', inset: 0, transform: 'translateY(' + -flip * 100 + '%)' }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  <Shot from={CUES.Search - 0.8} to={CUES.Results}><SearchScreen T={T} CUES={CUES} /></Shot>
                  <Shot from={CUES.Results} to={CUES.Request}><ResultsScreen T={T} CUES={CUES} /></Shot>
                  <Shot from={CUES.Request} to={CUES.Quote}><RequestScreen T={T} CUES={CUES} /></Shot>
                  <Shot from={CUES.Quote} to={CUES.Confirmed}><QuoteScreen T={T} CUES={CUES} /></Shot>
                  <Shot from={CUES.Confirmed} to={CUES.VendorDay}><ConfirmedScreen T={T} CUES={CUES} /></Shot>
                </div>
              </div>
              {/* vendor layer */}
              <div style={{ position: 'absolute', inset: 0, transform: 'translateY(' + (1 - flip) * 100 + '%)' }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  <Shot from={CUES.Flip} to={CUES.Close + 1}><VendorScreen T={T} CUES={CUES} /></Shot>
                </div>
              </div>
            </div>
            <Cursor x={cx} y={cy} on={cursorOn} click={click} />
          </div>
        </div>
      </div>

      <Shot from={CUES.Close - 0.9} to={total + 1}><Close T={T} CUES={CUES} total={total} /></Shot>

      {showCaptions && <Captions
        style={{
          left: '22%', right: '22%', bottom: 26, background: 'rgba(255,253,249,.94)', color: C.s900,
          font: '500 27px ' + SANS, padding: '15px 26px', borderRadius: 999, textShadow: 'none',
          boxShadow: '0 10px 34px rgba(35,32,28,.16)', border: '1px solid ' + C.s300,
        }}
        items={[
          { at: CUES.Scatter + 0.6, until: CUES.Bridge + 0.35, text: 'Booking event vendors used to mean fifteen tabs and four DMs.' },
          { at: CUES.Bridge + 0.55, until: CUES.Search + 0.6, text: 'Now — book your vendors without the back-and-forth.' },
          { at: CUES.Search + 0.9, until: CUES.Search + 5.7, text: 'Start with what you need, where, and when.' },
          { at: CUES.Results + 0.8, until: CUES.Results + 5.6, text: 'Clear prices. Open calendars.' },
          { at: CUES.Request + 0.7, until: CUES.Request + 5.0, text: 'Send one request — nothing is charged yet.' },
          { at: CUES.Quote + 1.0, until: CUES.Quote + 5.8, text: 'Pay securely once the date is locked in.' },
          { at: CUES.Flip + 0.5, until: CUES.VendorDay + 1.4, text: 'The same booking, from the vendor’s side.' },
          { at: CUES.VendorDay + 1.9, until: CUES.VendorDay + 7.6, text: 'Quote, block the date, get paid the day after.' },
        ]}
      />}
    </div>
  );
}

function OrlaIntroApp() {
  const defs = window.TWEAK_DEFAULTS || { motionEditor: true, captions: true, cursor: true };
  const [t, setTweak] = useTweaks(defs);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#E9E4DA">
        <OrlaIntro captions={t.captions} cursor={t.cursor} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Film" />
        <TweakToggle label="Captions" value={t.captions} onChange={(v) => setTweak('captions', v)} />
        <TweakToggle label="Cursor" value={t.cursor} onChange={(v) => setTweak('cursor', v)} />
        <TweakSection label="Editing" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={(v) => setTweak('motionEditor', v)} />
      </TweaksPanel>
    </div>
  );
}

window.OrlaIntro = OrlaIntro;
window.OrlaIntroApp = OrlaIntroApp;
