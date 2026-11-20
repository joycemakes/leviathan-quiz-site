// Leviathan link-up (SPEC section 5b): beliefs12, lane, zone labels, traits, flags and the export payload.
// `lev` is the parsed data/leviathan.json.

import { AXES, AXIS_IDS } from './axes.js?v=237f287-1795191068';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;

export function beliefs12(axisValues, lev) {
  return lev.axes12.map(ax => {
    const m = lev.map[ax.id] || {};
    let s = 0;
    for (const [qa, w] of Object.entries(m)) s += w * (axisValues[qa] || 0);
    return r2(clamp(s / 2, -1, 1));
  });
}

export function zoneIndex(v) {
  return clamp(Math.floor((1 - v) / (2 / 7)), 0, 6);
}
export function zoneLabel(v, axis12) {
  return axis12.zones[zoneIndex(v)];
}

export function laneFor(b12, lev, party) {
  let best = null;
  for (const lane of lev.lanes) {
    if (party && lane.party !== party) continue;
    let s = 0;
    for (let i = 0; i < 12; i++) s += (b12[i] - lane.centroid[i]) ** 2;
    const rms = Math.sqrt(s / 12);
    if (!best || rms < best.rms) best = { lane, rms };
  }
  if (!best) return null;
  return { id: best.lane.id, short: best.lane.short, name: best.lane.name, party: best.lane.party, rms: best.rms, pct: Math.round(100 * (1 - best.rms / 2)) };
}

// ---- Traits ---------------------------------------------------------------

const TRAIT_RULES = [
  ['mach', 1, 'Opportunistic', 1], ['mach', 1, 'Secretive', 0.9], ['mach', 1, 'Transactional', 0.85], ['mach', 1, 'Deceptive', 0.7],
  ['mach', -1, 'Honest', 1], ['mach', -1, 'Principled', 0.9], ['mach', -1, 'Scrupulous', 0.8],
  ['narc', 1, 'Ambitious', 1], ['narc', 1, 'Competitive', 0.8], ['narc', 1, 'Domineering', 0.6],
  ['narc', -1, 'Patient', 0.7], ['narc', -1, 'Diplomatic', 0.6],
  ['psych', 1, 'Ruthless', 1], ['psych', 1, 'Vindictive', 0.7],
  ['psych', -1, 'Protective', 0.9], ['psych', -1, 'Public-Spirited', 0.8], ['psych', -1, 'Trusting', 0.6],
  ['loyalty', 1, 'Loyal', 1], ['loyalty', 1, 'Partisan', 0.8],
  ['loyalty', -1, 'Independent-Minded', 1], ['loyalty', -1, 'Maverick', 0.6],
  ['style', 1, 'Domineering', 1], ['style', 1, 'Competitive', 0.7], ['style', 1, 'Impulsive', 0.6],
  ['style', -1, 'Diplomatic', 1], ['style', -1, 'Consensus-Seeker', 0.9], ['style', -1, 'Composed', 0.7],
  ['system', 1, 'Populist', 0.9], ['system', 1, 'Maverick', 0.9], ['system', 1, 'Restless', 0.6],
  ['system', -1, 'Institutionalist', 1], ['system', -1, 'Cautious', 0.6],
  ['online', 1, 'Restless', 0.6], ['online', 1, 'Gregarious', 0.5],
  ['online', -1, 'Conventional', 0.5], ['online', -1, 'Aloof', 0.4],
  ['tech', 1, 'Technocrat', 0.8], ['tech', 1, 'Creative', 0.5],
  ['democracy', 1, 'Consensus-Seeker', 0.5], ['democracy', -1, 'Decisive', 0.7], ['democracy', -1, 'Domineering', 0.5],
  ['dynasty', 1, 'Machine-Minded', 0.8],
  ['libertine', 1, 'Impulsive', 0.6], ['libertine', -1, 'Disciplined', 0.8], ['libertine', -1, 'Scrupulous', 0.5],
  ['faith', 1, 'Principled', 0.5],
];

export const TRAIT_OPPOSITES = [
  ['Patient', 'Impulsive'], ['Cautious', 'Courageous'], ['Restless', 'Composed'], ['Stubborn', 'Adaptable'],
  ['Gregarious', 'Aloof'], ['Affable', 'Domineering'], ['Diplomatic', 'Domineering'], ['Suspicious', 'Trusting'],
  ['Delegator', 'Micromanager'], ['Decisive', 'Indecisive'], ['Creative', 'Conventional'],
  ['Honest', 'Deceptive'], ['Honest', 'Secretive'], ['Scrupulous', 'Corruptible'], ['Principled', 'Opportunistic'],
  ['Principled', 'Transactional'], ['Ruthless', 'Protective'], ['Ruthless', 'Public-Spirited'],
  ['Pragmatist', 'Ideologue'], ['Partisan', 'Independent-Minded'], ['Institutionalist', 'Maverick'],
  ['Institutionalist', 'Populist'], ['Technocrat', 'Populist'], ['Consensus-Seeker', 'Domineering'],
  ['Loyal', 'Independent-Minded'], ['Loyal', 'Vindictive'],
];

export function areOpposite(a, b) {
  return TRAIT_OPPOSITES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// scores: axisScores() output. Returns 3 trait names from lev.traits, no opposite pairs.
export function suggestTraits(scores, lev) {
  const valid = new Set(Object.values(lev?.traits || {}).flat());
  const best = {};
  const bump = (t, s) => { if ((!valid.size || valid.has(t)) && s > (best[t] || 0)) best[t] = s; };
  for (const [axis, dir, trait, w] of TRAIT_RULES) {
    const s = scores[axis];
    if (!s || !(s.evidence > 0)) continue;
    const v = s.value * dir;
    if (v < 0.4) continue;
    bump(trait, v * w * (0.5 + 0.5 * s.conf));
  }
  const ideo = AXES.filter(a => a.group === 'ideology' && scores[a.id]?.evidence > 0);
  if (ideo.length) {
    const mean = ideo.reduce((t, a) => t + Math.abs(scores[a.id].value), 0) / ideo.length;
    if (mean > 1.1) bump('Ideologue', (mean - 0.7) * 1.5);
    if (mean < 0.6) bump('Pragmatist', (0.9 - mean) * 1.5);
  }
  const ranked = Object.entries(best).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(e => e[0]);
  const out = [];
  for (const t of ranked.concat(['Pragmatist', 'Adaptable', 'Ambitious', 'Resilient'])) {
    if (out.length >= 3) break;
    if (out.includes(t) || out.some(o => areOpposite(o, t))) continue;
    out.push(t);
  }
  return out;
}

export function deriveFlags(scores, scorerFlags = {}) {
  const lib = scores.libertine;
  const faith = scorerFlags.faith || null;
  return {
    dynasty: (scores.dynasty?.value || 0) >= 1.2,
    faithProfessed: faith ? faith.professed : null,
    faithPrivate: faith ? faith.private : null,
    sexAppeal: lib && lib.evidence > 0 ? clamp(Math.round(5 + 2 * lib.value), 1, 10) : null,
  };
}

// Full profile used by the result screen and the export code.
export function buildProfile({ scores, matches, candidates, lev, route, length, scorerFlags, t = Math.floor(Date.now() / 1000) }) {
  const values = Object.fromEntries(AXIS_IDS.map(a => [a, scores[a].value]));
  const b12 = lev ? beliefs12(values, lev) : [];
  const lane = lev ? laneFor(b12, lev, route) : null;
  // The route decides the lane Leviathan seats you in, but when the other party's nearest lane fits
  // clearly better (10 points or more), say so (playtest 2: four Republicans on top, a Democratic lane).
  const anyLane = lev ? laneFor(b12, lev, null) : null;
  const laneAlt = lane && anyLane && anyLane.party !== lane.party && anyLane.pct >= lane.pct + 10 ? anyLane : null;
  const top = matches.slice(0, 5);
  const traits = suggestTraits(scores, lev);
  const flags = deriveFlags(scores, scorerFlags);
  const code = {
    v: 1, r: route, n: length,
    ax: Object.fromEntries(AXIS_IDS.map(a => [a, r1(values[a])])),
    b12,
    lane: lane ? lane.id : '',
    lanePct: lane ? lane.pct : 0,
    ...(laneAlt ? { laneAlt: laneAlt.id, laneAltPct: laneAlt.pct } : {}),
    tem: { mach: r1(values.mach), narc: r1(values.narc), psych: r1(values.psych) },
    traits,
    flags,
    top: top.map(m => m.id),
    pct: top.map(m => m.pct),
    t,
  };
  return { values, b12, lane, laneAlt, top, traits, flags, code };
}
