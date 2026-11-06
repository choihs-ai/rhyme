// 라임 스캐너 — 추천 단어 검색
// data/*.json 의 색인 키는 단어의 실제 발음에서 초성을 ㅇ으로 바꾼 '운' 문자열 (예: 머니 → 어이).
// 입력 단어의 발음 운과 끝을 맞춰 비교해 모음 패턴이 맞는 단어를 찾는다.
import { decompose, compose, analyzePronunciation, getEnglishDictionary } from './pronounce.js';
import { vowelSim, codaSim } from './rhyme.js';

let ENTRIES = [];
let counts = { ko: 0, en: 0 };

export function setDictionaries(koJson, enJson) {
  ENTRIES = [];
  const add = (json, lang) => {
    if (!json || !json.idx) return;
    for (const key in json.idx) {
      const units = [];
      for (const ch of key) { const d = decompose(ch); if (d) units.push(d); }
      ENTRIES.push({ key, units, lang, raw: json.idx[key] });
    }
  };
  add(koJson, 'ko');
  add(enJson, 'en');
  counts = { ko: koJson ? koJson.count : 0, en: enJson ? (enJson.rap || '').split(' ').length : 0 };
  return ENTRIES.length;
}
export const dictionaryCounts = () => counts;

/**
 * @param {string} query
 * @param {{lang?: 'all'|'ko'|'en', coda?: boolean, limit?: number, overrides?: Map}} opt
 */
export function recommend(query, opt = {}) {
  const { lang = 'all', coda = false, limit = 60, overrides } = opt;
  const q = query.trim();
  if (!q) return null;
  const pron = analyzePronunciation(q, { overrides });
  const syl = pron.syllables;
  if (!syl.length) return { error: '발음할 수 있는 글자가 없습니다.' };
  if (!ENTRIES.length) return { error: '사전을 아직 불러오지 못했습니다. 잠시 후 다시 시도하세요.' };
  const n = syl.length;
  const qn = syl.map(s => ({ v: s.jung, c: s.jong }));
  const lowerQ = q.toLowerCase().replace(/\s+/g, '');
  const scored = [];
  for (const e of ENTRIES) {
    if (lang !== 'all' && e.lang !== lang) continue;
    const m = e.units.length;
    if (m < Math.max(1, n - 1)) continue;          // 한 음절까지 짧은 것 허용
    const k = Math.min(n, m);
    let sum = 0, ok = true;
    for (let t = 1; t <= k; t++) {
      const a = qn[n - t], b = e.units[m - t];
      const v = vowelSim(a.v, b.jung);
      if (v < 0.6) { ok = false; break; }
      const c = codaSim(a.c, b.jong);
      if (coda && c < 0.6) { ok = false; break; }
      // 끝 음절일수록 중요
      const w = t === 1 ? 1.2 : 1;
      sum += (v * 0.75 + c * 0.25) * w;
    }
    if (!ok) continue;
    let score = sum / (k + 0.2);
    if (k < n) score *= 0.85 * (k / n) + 0.15;      // 입력보다 짧으면 감점
    if (score < 0.68) continue;
    scored.push({ e, score: Math.min(1, score), m });
  }
  // 음절 수별로 묶고, 같은 점수대에서는 단어 목록을 번갈아(빈도순) 뽑는다
  const byLen = new Map();
  for (const s of scored) {
    if (!byLen.has(s.m)) byLen.set(s.m, []);
    byLen.get(s.m).push(s);
  }
  const enDict = getEnglishDictionary();
  const groups = [];
  for (const [len, list] of byLen) {
    list.sort((a, b) => b.score - a.score);
    const items = [];
    let more = false;
    let i = 0;
    while (i < list.length && items.length < limit) {
      // 같은 점수(소수 둘째 자리) 묶음
      let j = i;
      const sc = Math.round(list[i].score * 100);
      while (j < list.length && Math.round(list[j].score * 100) === sc) j++;
      const bucket = list.slice(i, j).map(s => {
        const [t1, t2] = s.e.raw.split('|');
        return { s, lists: [t1 ? t1.split(' ') : [], t2 ? t2.split(' ') : []] };
      });
      for (const tier of [0, 1]) {
        let depth = 0, added = true;
        while (added && items.length < limit) {
          added = false;
          for (const b of bucket) {
            const w = b.lists[tier][depth];
            if (w === undefined) continue;
            added = true;
            if (w.replace(/\s+/g, '').toLowerCase() === lowerQ) continue;
            items.push({ w, lang: b.s.e.lang, score: b.s.score, tier, pron: b.s.e.lang === 'en' ? (enDict.get(w) || '').replace(/'/g, '') : '' });
            if (items.length >= limit) break;
          }
          depth++;
        }
      }
      if (items.length >= limit && (j < list.length)) more = true;
      i = j;
    }
    if (items.length) groups.push({ len, items, more: more || items.length >= limit });
  }
  // 입력과 같은 음절 수 먼저, 그다음 짧은 순
  groups.sort((a, b) => (a.len === n ? -1 : b.len === n ? 1 : a.len - b.len));
  return {
    query: q,
    pron: syl.map(s => s.ch).join(''),
    pattern: syl.map(s => s.jung).join('-'),
    rime: syl.map(s => compose('ㅇ', s.jung, s.jong)).join(''),
    groups,
  };
}
