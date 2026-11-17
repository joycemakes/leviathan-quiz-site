// The result screen: ghost reveal, top five, lane and Leviathan zones, ideology gauges, temperament,
// dynasty and libertine dials, traits and flags, the share sheet and the LVQ1 code.

import { AXES, AXIS } from './axes.js';
import { reasonFor } from './scoring.js';
import { zoneLabel } from './leviathan.js';
import { encodeLVQ1 } from './export.js';
import { portraitEl } from './art.js';
import { silhouetteEl } from './hud.js';
import { haptic, sleep, reducedMotion } from './feel.js';
import { sfx } from './sound.js';
import { renderShareSheet, copyText } from './sharesheet.js';
import { normalizeShareConfig } from './share.js';

const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const section = (title, cls = '') => {
  const s = h('section', `res-block ${cls}`);
  s.appendChild(h('h3', 'res-h', title));
  return s;
};
const partyName = p => (p === 'dem' ? 'Democrat' : p === 'gop' ? 'Republican' : '');
const word = v => (v >= 1.2 ? 'High' : v >= 0.4 ? 'Above average' : v > -0.4 ? 'Middling' : v > -1.2 ? 'Below average' : 'Low');

function gauge(ax, value, conf) {
  const row = h('div', 'gauge');
  if (!(conf > 0)) row.classList.add('no-evidence');
  const pct = ((value + 2) / 4) * 100;
  row.innerHTML = `<div class="gauge-ends"><span>${ax.neg}</span><span>${ax.pos}</span></div>
    <div class="gauge-track"><span class="gauge-mid"></span><span class="gauge-needle" style="left:${pct}%"></span></div>`;
  row.setAttribute('aria-label', `${ax.neg} to ${ax.pos}: ${value.toFixed(1)}`);
  return row;
}

function dial(label, value, sub) {
  const el = h('div', 'dial');
  const ang = (value / 2) * 90; // -2..2 -> -90..90 degrees
  el.innerHTML = `<svg viewBox="0 0 100 60" aria-hidden="true">
      <path class="dial-arc" d="M10 55 A40 40 0 0 1 90 55"/>
      ${[-90, -45, 0, 45, 90].map(a => `<line class="dial-tick" x1="50" y1="15" x2="50" y2="21" transform="rotate(${a} 50 55)"/>`).join('')}
      <g class="dial-needle" style="transform: rotate(${ang}deg)"><line x1="50" y1="55" x2="50" y2="20"/></g>
      <rect class="dial-hub" x="46" y="51" width="8" height="8"/>
    </svg>`;
  el.append(h('div', 'dial-label', label), h('div', 'dial-sub', sub || word(value)));
  el.setAttribute('aria-label', `${label}: ${sub || word(value)}`);
  return el;
}

export function renderResults(root, R) {
  const { profile, matches, scores, cands, lev, route, length, signals } = R;
  root.innerHTML = '';
  const screen = h('div', 'results');
  root.appendChild(screen);

  const head = h('header', 'res-head');
  head.append(h('div', 'wordmark sm', 'Leviathan'), h('div', 'eyebrow', `The 2028 Quiz · ${partyName(route)} route · ${length} questions`));
  screen.appendChild(head);

  // ---- ghost reveal ----
  const pod = h('div', 'podium');
  matches.slice(0, 3).forEach((m, i) => {
    const c = cands.get(m.id);
    const slot = h('div', `pod pod-${i + 1}`);
    const card = h('div', 'pod-card');
    const sil = h('div', 'pod-sil');
    sil.appendChild(silhouetteEl(m.id, 'pod-sil-img'));
    card.append(sil, portraitEl(c, 'pod-portrait'));
    slot.append(card, h('div', 'pod-rank', String(i + 1)), h('div', 'pod-name', c.name), h('div', 'pod-pct', `${m.pct}%`));
    pod.appendChild(slot);
  });
  screen.appendChild(pod);
  (async () => {
    await sleep(reducedMotion() ? 50 : 500);
    sfx('swell');
    for (const p of pod.querySelectorAll('.pod')) { p.classList.add('revealed'); haptic('select'); await sleep(reducedMotion() ? 0 : 260); }
  })();

  // ---- top five ----
  const top = section('Your top five');
  const ol = h('ol', 'top5');
  const laneShort = id => lev?.lanes.find(l => l.id === id)?.short || '';
  const usedPhrases = new Set();
  matches.slice(0, 5).forEach((m, i) => {
    const c = cands.get(m.id);
    const li = h('li', 'top5-row');
    li.dataset.cand = m.id;
    const meta = h('div', 'top5-meta');
    const name = h('div', 'top5-name');
    name.append(h('span', 'top5-rank', `${i + 1}`), document.createTextNode(c.name));
    const tags = h('div', 'top5-tags');
    tags.append(h('span', `tag party-${c.party}`, partyName(c.party)));
    if (c.lane) tags.append(h('span', 'tag lane', laneShort(c.lane) || c.lane));
    meta.append(name, h('div', 'top5-title', c.title || ''), tags, h('p', 'top5-reason', reasonFor(scores, c, m.picks, usedPhrases)));
    const pct = h('div', 'top5-pct');
    // Below 25 the number means only far away, so say that instead of printing 8%.
    if (m.pct < 25) { pct.classList.add('low'); pct.append(h('span', 'pct-low', 'under 25%')); }
    else pct.append(h('span', 'pct-n', `${m.pct}`), h('span', 'pct-s', '%'));
    li.append(portraitEl(c, 'md'), meta, pct);
    ol.appendChild(li);
  });
  top.appendChild(ol);
  screen.appendChild(top);

  // ---- lane + Leviathan zones ----
  if (profile.lane) {
    const lane = section('Your lane in Leviathan', 'lane-block');
    const big = h('div', 'lane-big');
    big.append(h('span', 'lane-short', profile.lane.short), h('span', 'lane-name', profile.lane.name), h('span', 'lane-pct', `${profile.lane.pct}% fit`));
    lane.appendChild(big);
    const otherParty = matches[0] && cands.get(matches[0].id)?.party !== route;
    if (profile.laneAlt) {
      lane.appendChild(h('p', 'lane-note', `Your beliefs sit closer to the other party: ${profile.laneAlt.short}, ${profile.laneAlt.name}, ${profile.laneAlt.pct}% fit. The lane above is the nearest one in the primary you chose, which is where Leviathan seats you.`));
    } else if (otherParty) {
      lane.appendChild(h('p', 'lane-note', `Your closest match runs in the other primary. The lane above is the nearest one in the primary you chose.`));
    }
    const zones = h('div', 'zones');
    lev.axes12.forEach((ax, i) => {
      const v = profile.b12[i];
      const z = h('div', 'zone');
      z.append(h('span', 'zone-axis', `${ax.pos} / ${ax.neg}`), h('span', 'zone-label', zoneLabel(v, ax)));
      zones.appendChild(z);
    });
    lane.appendChild(zones);
    screen.appendChild(lane);
  }

  // ---- ideology gauges ----
  const ideo = section('Ideology');
  const g = h('div', 'gauges');
  for (const ax of AXES.filter(a => a.group === 'ideology' || a.group === 'style')) g.appendChild(gauge(ax, scores[ax.id].value, scores[ax.id].conf));
  ideo.appendChild(g);
  screen.appendChild(ideo);

  // ---- temperament ----
  const tem = section('Temperament');
  const trio = h('div', 'dials trio');
  trio.append(dial('Machiavellianism', scores.mach.value), dial('Narcissism', scores.narc.value), dial('Psychopathy', scores.psych.value));
  tem.appendChild(trio);
  screen.appendChild(tem);

  // ---- power: dynasty and libertine ----
  const pow = section('Power and private life');
  const duo = h('div', 'dials duo');
  duo.append(
    dial('Dynasty', scores.dynasty.value, scores.dynasty.value >= 0.4 ? 'Family power is fine' : scores.dynasty.value <= -0.4 ? 'Meritocrat' : 'Undecided'),
    dial('Libertine', scores.libertine.value, scores.libertine.value >= 0.4 ? 'Scandal-proof' : scores.libertine.value <= -0.4 ? 'Puritan' : 'Discreet'),
  );
  pow.appendChild(duo);
  screen.appendChild(pow);

  // ---- traits and flags ----
  const sheet = section('For your character sheet');
  const tr = h('div', 'traits');
  for (const t of profile.traits) tr.appendChild(h('span', 'trait', t));
  const fl = h('dl', 'flags');
  const f = profile.flags;
  const add = (k, v) => { fl.append(h('dt', null, k), h('dd', null, v)); };
  add('Family wealth', f.dynasty ? 'Political dynasty' : 'Not a dynasty');
  add('Faith', f.faithProfessed ? `Professed ${f.faithProfessed}, privately ${f.faithPrivate}` : 'Not asked');
  add('Sex appeal hint', f.sexAppeal ? `${f.sexAppeal} of 10` : 'No evidence');
  const tells = [];
  if (signals.hesitations) tells.push(`${signals.hesitations} slow answer${signals.hesitations > 1 ? 's' : ''} on loyalty and envelopes`);
  if (signals.holdStrengths.length) tells.push(`average hold ${Math.round((signals.holdStrengths.reduce((a, b) => a + b, 0) / signals.holdStrengths.length) * 100)}%`);
  if (signals.swipes) tells.push(`${signals.fastSwipes} of ${signals.swipes} swipes under a second and a half`);
  if (tells.length) add('Tells', tells.join('; '));
  sheet.append(tr, fl);
  screen.appendChild(sheet);

  // ---- share ----
  const share = section('Share your result', 'share-block');
  renderShareSheet(share, { profile, matches, cands, route, scores, shareCfg: R.shareCfg || normalizeShareConfig(null) });
  screen.appendChild(share);

  // ---- export code ----
  const code = encodeLVQ1(profile.code);
  const ex = section('Your Leviathan code', 'export-block');
  ex.appendChild(h('p', 'hint', 'Paste this into Leviathan to pre-fill a character: beliefs, lane, temperament, traits and flags.'));
  const box = h('output', 'code-box', code);
  box.setAttribute('aria-label', 'LVQ1 export code');
  const sum = code.slice(-4);
  const row = h('div', 'code-row');
  const copy = h('button', 'btn primary copy', 'Copy code');
  copy.type = 'button';
  const status = h('span', 'code-sum', `Checksum ${sum}`);
  copy.addEventListener('click', async () => {
    const ok = await copyText(code);
    copy.textContent = ok ? 'Copied' : 'Select and copy';
    haptic(ok ? 'commit' : 'error');
    if (!ok) { const r = document.createRange(); r.selectNodeContents(box); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    setTimeout(() => { copy.textContent = 'Copy code'; }, 1800);
  });
  row.append(copy, status);
  ex.append(box, row);
  screen.appendChild(ex);

  const again = h('button', 'btn again', 'Play again');
  again.type = 'button';
  again.addEventListener('click', () => R.onAgain && R.onAgain());
  screen.append(again, h('p', 'fineprint', 'Real officeholders appear only in their portraits. Everything else is simulated fiction. Match percentages are editorial estimates, not claims.'));
  return { code };
}
