// 라임 스캐너 — 라임 판정·그룹화·점수 계산
import { JUNG, compose } from './pronounce.js';

// ───────────────────────── 유사도 ─────────────────────────
// 같은 소리 취급 그룹 (0.9)
const SAME = [['ㅐ', 'ㅔ'], ['ㅙ', 'ㅚ', 'ㅞ'], ['ㅒ', 'ㅖ']];
// 비슷한 소리 (0.6)
const SIMILAR = [['ㅓ', 'ㅗ'], ['ㅡ', 'ㅜ'], ['ㅣ', 'ㅟ']];
// 이중모음 → 단모음 핵
const CORE = { 'ㅑ': 'ㅏ', 'ㅘ': 'ㅏ', 'ㅕ': 'ㅓ', 'ㅝ': 'ㅓ', 'ㅛ': 'ㅗ', 'ㅠ': 'ㅜ', 'ㅒ': 'ㅐ', 'ㅖ': 'ㅐ', 'ㅙ': 'ㅐ', 'ㅞ': 'ㅐ', 'ㅚ': 'ㅐ', 'ㅟ': 'ㅣ', 'ㅢ': 'ㅣ', 'ㅔ': 'ㅐ' };
const core = v => CORE[v] || v;

export function vowelSim(a, b) {
  if (a === b) return 1;
  for (const g of SAME) if (g.includes(a) && g.includes(b)) return 0.9;
  for (const [x, y] of SIMILAR) if ((a === x && b === y) || (a === y && b === x)) return 0.6;
  if (core(a) === core(b)) return 0.6;
  return 0;
}
// 21×21 표로 미리 계산
const VS = JUNG.map(a => JUNG.map(b => vowelSim(a, b)));
const VIDX = Object.fromEntries(JUNG.map((v, i) => [v, i]));

const NASAL = new Set(['ㄴ', 'ㅁ', 'ㅇ']);
const STOP = new Set(['ㄱ', 'ㄷ', 'ㅂ']);
export function codaSim(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0.3;
  if ((NASAL.has(a) && NASAL.has(b)) || (STOP.has(a) && STOP.has(b))) return 0.6;
  return 0;
}
// 같은 소리 그룹으로 접은 모음 (그룹 병합 키)
const CANON = { 'ㅔ': 'ㅐ', 'ㅚ': 'ㅙ', 'ㅞ': 'ㅙ', 'ㅖ': 'ㅒ' };
const canon = v => CANON[v] || v;

const W_VOWEL = 0.75, W_CODA = 0.25;
// 조사·어미로 자주 쓰이는 음절 — 양쪽 끝이 모두 이것이면 문법적 우연일 가능성이 커서 약하게 본다.
// ('어/아/해' 계열 어미는 한국어 랩 라임의 핵심이라 제외: 없어/걸어)
const GRAMMAR = new Set('은 는 을 를 이 가 에 의 도 만 와 과 로 고 서 면 다 요 지 게 며 니 까 께 랑 든 던 죠 네 데 음 기 여 다가 한 할 된 될 는데'.split(' '));
const GRAMMAR_W = 0.35;

// ───────────────────────── 옵션 ─────────────────────────
export const DEFAULT_OPTIONS = { vowelOnly: true, minLen: 1, sensitivity: 50, maxLen: 8 };

function params(opt) {
  const t = Math.max(0, Math.min(100, opt.sensitivity)) / 100;
  return {
    T: 0.92 - 0.3 * t,                  // 평균 유사도 하한 (민감도 50 → 0.77)
    minV: t < 0.25 ? 0.9 : 0.6,          // 음절별 모음 유사도 하한
    W: L => (L === 1 ? (t >= 0.7 ? 1 : 0) : L === 2 ? Math.round(2 + 2 * t) : L === 3 ? Math.round(4 + 4 * t) : Math.round(8 + 8 * t)),
    W1end: 3,                            // 1음절 끝라임 거리 (AABB·ABAB·ABBA)
  };
}

// ───────────────────────── 분석 ─────────────────────────
/**
 * @param pron analyzePronunciation() 결과
 * @param options {vowelOnly, minLen, sensitivity, maxLen}
 */
export function analyzeRhymes(pron, options = {}) {
  const opt = { ...DEFAULT_OPTIONS, ...options };
  const P = params(opt);
  const S = pron.syllables;
  const content = pron.lines.filter(l => !l.blank && !l.header && l.syl.length);
  const lineRange = new Map(content.map(l => [l.idx, [l.syl[0], l.syl[l.syl.length - 1] + 1]]));

  // 뒤(앞)에 같은 단어의 삽입모음만 남으면 단어 끝(시작)으로 본다: road=로+드 → '로'가 단어·줄 끝
  const trailEp = (i, lim, same) => { for (let k = i + 1; k < lim; k++) { if (!same(k)) return true; if (!S[k].ep) return false; } return true; };
  const leadEp = (i, lim, same) => { for (let k = i - 1; k >= lim; k--) { if (!same(k)) return true; if (!S[k].ep) return false; } return true; };
  // 음절 단위 정보
  const U = S.map((s, i) => {
    const w = pron.words[s.word];
    const [la, lb] = lineRange.get(s.line);
    return {
      i, v: VIDX[s.jung], vj: s.jung, c: s.jong, o: s.cho, ep: s.ep, n: s.ln, verse: s.verse, line: s.line,
      ws: leadEp(i, la, k => S[k].word === s.word), we: trailEp(i, lb, k => S[k].word === s.word),
      le: trailEp(i, lb, () => true), ls: i === la,
      gram: s.lang === 'ko' && s.wi === s.wn - 1 && s.wn > 1 && GRAMMAR.has(s.orth),
      key: s.lang === 'ko' ? s.orth : `${w.text.toLowerCase()}#${s.wi}`, wkey: `${w.text.toLowerCase()}#${s.wi}`, lang: s.lang, word: s.word,
    };
  });

  // 두 구간 비교
  function compare(a, b, L, strict) {
    let vs = 0, cs = 0, os = 0, epA = true, epB = true, minv = 1, sameWord = 0, epPairs = 0;
    for (let k = 0; k < L; k++) {
      const x = U[a + k], y = U[b + k];
      let v = VS[x.v][y.v];
      if (x.ep !== y.ep) v *= 0.6;                  // 삽입모음 ↔ 실제 모음은 약하게
      else if (x.ep) { v *= 0.9; epPairs++; }
      if (v < P.minV) return null;
      if (L > 1 && x.wkey === y.wkey) sameWord++;
      const c = codaSim(x.c, y.c);
      if (!opt.vowelOnly && c < 0.6) return null;
      if (strict && v < 0.9) return null;
      const gw = x.gram && y.gram ? GRAMMAR_W : 1;  // 양쪽 다 조사·어미면 약하게
      vs += v * gw; cs += c * gw; if (x.o === y.o) os++;
      if (v < minv) minv = v;
      if (!x.ep) epA = false;
      if (!y.ep) epB = false;
    }
    if (epA || epB) return null;
    if (sameWord && sameWord < L) return null;    // 같은 단어가 섞인 구간 (내 방 / 내 사상)
    for (let k = 0; k < L; k++) if (U[a + k].ep !== U[b + k].ep) epPairs++;
    if (epPairs > (L === 2 ? 1 : Math.floor((L - 1) / 2))) return null; // 삽입모음 위주 일치 제외
    return { sim: (vs * W_VOWEL + cs * W_CODA) / L, v: vs / L, c: cs / L, o: os / L, minv };
  }
  const segKey = (a, L) => { let k = ''; for (let t = 0; t < L; t++) k += U[a + t].key + '|'; return k; };

  // ── 1) 후보 쌍 수집 ──
  const cands = [];
  const maxW = Math.max(P.W(opt.maxLen), P.W1end);
  for (let li = 0; li < content.length; li++) {
    const A = content[li];
    const [a0, a1] = lineRange.get(A.idx);
    for (let lj = li; lj < content.length; lj++) {
      const B = content[lj];
      const d = B.n - A.n;
      if (d > maxW) break;
      const [b0, b1] = lineRange.get(B.idx);
      for (let a = a0; a < a1; a++) {
        for (let b = (li === lj ? a + 1 : b0); b < b1; b++) {
          // 같은 위치에서 시작하는 가장 긴 일치 길이
          let R = 0;
          const lim = Math.min(opt.maxLen, a1 - a, b1 - b, li === lj ? b - a : Infinity);
          while (R < lim && VS[U[a + R].v][U[b + R].v] >= P.minV) R++;
          if (U[a].ep || U[b].ep) continue;               // 라임은 실제 모음에서 시작
          for (let L = Math.max(1, opt.minLen); L <= R; L++) {
            const sameVerse = U[a].verse === U[b].verse;
            if (L <= 3 && !sameVerse) continue;
            const isEnd = U[a + L - 1].le && U[b + L - 1].le;
            const W = L === 1 ? (isEnd ? P.W1end : P.W(1)) : P.W(L);
            if (d > W) continue;
            const m = compare(a, b, L, L === 1);
            if (!m) continue;
            const alignEnd = U[a + L - 1].we && U[b + L - 1].we;
            const alignStart = U[a].ws && U[b].ws;
            const fullA = U[a].ws && U[a + L - 1].we, fullB = U[b].ws && U[b + L - 1].we;
            // 반복: 2음절 이상은 같은 글자열, 1음절은 같은 단어일 때
            const repeat = L === 1 ? U[a].wkey === U[b].wkey && pron.words[U[a].word].text === pron.words[U[b].word].text : segKey(a, L) === segKey(b, L);
            if (L === 1) {
              if (U[a].ep || U[b].ep) continue;
              if (U[a].gram && U[b].gram) continue;   // 했다/먹었다의 '다' 같은 어미끼리는 1음절 라임으로 보지 않음
              if (!isEnd && !(alignEnd && m.c >= 0.6)) continue;
            } else {
              if (m.sim < P.T + 0.02 * d) continue;      // 멀수록 더 닮아야 함
              if (L === 2 && !(alignEnd || isEnd || (alignStart && (fullA || fullB)))) continue;
              if (L >= 3 && !(alignEnd || isEnd)) continue;  // 3음절 이상은 단어/줄 끝에서 끝나야 함
            }
            const dist = L === 1 ? (d === 0 ? 1 : 0.85 - 0.1 * (d - 1)) : L === 2 ? (d <= 1 ? 1 : 1 - 0.15 * (d - 1)) : Math.max(0.6, 1 - 0.04 * d);
            // 길이 우선 + 품질(유사도², 단어·줄 끝 정렬) 반영
            const score = Math.pow(L, 1.2) * m.sim * m.sim * (1 + 0.25 * alignEnd + 0.2 * alignStart + 0.6 * isEnd + 0.1 * m.o) * dist;
            // 그룹을 새로 만들 수 있는 '강한 씨앗' 쌍인가
            let seed;
            if (L === 1) seed = isEnd || d === 0;
            else if (isEnd) seed = true;
            else if (L === 2) seed = alignEnd && (d <= 1 || (d <= 2 && (U[a + 1].le || U[b + 1].le))) && m.sim >= 0.87;
            else seed = alignEnd && m.sim >= 0.85 && (U[a].ws || U[b].ws);
            cands.push({ a, b, L, d, sim: m.sim, score, repeat, isEnd, alignEnd, alignStart, seed });
          }
        }
      }
    }
  }
  cands.sort((x, y) => y.score - x.score || y.L - x.L);

  // ── 2) 그룹 형성 (긴 라임 우선) ──
  const owner = new Int32Array(S.length).fill(-1);       // 음절 → 그룹 멤버 id
  const members = [];                                     // {id, a, L, g, repeat}
  const memberAt = new Map();                             // `${a}:${L}` → member id
  const groups = [];                                      // {id, L, members:[mid], alive}
  const isFree = (a, L) => { for (let t = 0; t < L; t++) if (owner[a + t] >= 0) return false; return true; };
  const addMember = (g, a, L) => {
    const id = members.length;
    members.push({ id, a, L, g: g.id, repeat: false });
    memberAt.set(`${a}:${L}`, id);
    for (let t = 0; t < L; t++) owner[a + t] = id;
    g.members.push(id);
    return id;
  };
  const near = (g, a, L) => {
    const W = L === 1 ? Math.max(P.W(1), U[a].le ? P.W1end : 0) : P.W(L);
    return g.members.some(mid => Math.abs(U[members[mid].a].n - U[a].n) <= W);
  };
  const fits = (g, a, L) => {
    const rep = members[g.members[0]];
    if (rep.L !== L) return false;
    // 단어 끝에서 끝나지 않는 멤버(갈망|한)는 끝라임 그룹에만 합류
    if (L > 1 && !U[a + L - 1].we && !U[a + L - 1].le && g.members.filter(mid => U[members[mid].a + L - 1].le).length < 2) return false;
    if (L === 1) return !!compare(rep.a, a, 1, true);
    const m = compare(rep.a, a, L, false);
    return !!m && m.sim >= P.T - 0.05;
  };
  const canonKey = (a, L) => { let k = ''; for (let t = 0; t < L; t++) k += canon(U[a + t].vj); return k; };

  function process(c, allowCreate) {
    const ka = memberAt.get(`${c.a}:${c.L}`), kb = memberAt.get(`${c.b}:${c.L}`);
    const ga = ka !== undefined ? groups[members[ka].g] : null;
    const gb = kb !== undefined ? groups[members[kb].g] : null;
    if (ga && gb) {
      if (ga !== gb && ga.alive && gb.alive && canonKey(members[ga.members[0]].a, c.L) === canonKey(members[gb.members[0]].a, c.L)) {
        // 병합
        for (const mid of gb.members) { members[mid].g = ga.id; ga.members.push(mid); }
        gb.members = []; gb.alive = false;
      }
      return;
    }
    if (ga && isFree(c.b, c.L)) { if (ga.alive && fits(ga, c.b, c.L) && near(ga, c.b, c.L)) addMember(ga, c.b, c.L); return; }
    if (gb && isFree(c.a, c.L)) { if (gb.alive && fits(gb, c.a, c.L) && near(gb, c.a, c.L)) addMember(gb, c.a, c.L); return; }
    if (allowCreate && c.seed && !ga && !gb && isFree(c.a, c.L) && isFree(c.b, c.L)) {
      const g = { id: groups.length, L: c.L, members: [], alive: true };
      groups.push(g);
      addMember(g, c.a, c.L);
      addMember(g, c.b, c.L);
    }
  }
  // 반복이 아닌 쌍으로 그룹을 만들고, 같은 말 반복은 기존 그룹에만 붙인다
  for (const c of cands) if (!c.repeat) process(c, true);
  for (let pass = 0; pass < 2; pass++) for (const c of cands) if (c.repeat) process(c, false);

  // ── 3) 반복 표시 + 그룹 검증 ──
  function freeMember(mid) {
    const m = members[mid];
    for (let t = 0; t < m.L; t++) if (owner[m.a + t] === mid) owner[m.a + t] = -1;
    memberAt.delete(`${m.a}:${m.L}`);
  }
  // 대표 멤버와의 평균 유사도
  const quality = list => {
    if (list.length < 2) return 0;
    const rep = list[0];
    let sum = 0;
    for (let k = 1; k < list.length; k++) { const m = compare(rep.a, list[k].a, rep.L, false); sum += m ? m.sim : 0; }
    return sum / (list.length - 1);
  };
  // 우연한 모음 일치를 걸러낸다: 끝라임 / 3음절 이상 / 가까이 몰린 3개 이상 / 단어 끝이 맞는 가까운 2개
  function validate(g) {
    const M = g.members.map(mid => members[mid]);
    const real = M.filter(m => !m.repeat);
    if (real.length < 2) return null;
    const L = g.L;
    const isEnd = m => U[m.a + L - 1].le;
    const endAl = m => U[m.a + L - 1].we;
    const ln = m => U[m.a].n;
    const all = new Set(g.members);
    const ends = real.filter(isEnd);
    if (L === 1) return ends.length >= 2 || real.length >= 3 ? all : null;
    if (ends.length >= 2) return all;
    if (L >= 3 && quality(real) >= 0.85 && real.some(m => U[m.a].ws)) return all;
    // 가까이(1줄 이내) 이웃이 있는 멤버만 남긴다
    const near1 = real.filter(m => real.some(o => o !== m && Math.abs(ln(o) - ln(m)) <= 1));
    const keepWithRepeats = list => {
      const ids = new Set(list.map(m => m.id));
      M.filter(m => m.repeat && list.some(o => Math.abs(ln(o) - ln(m)) <= 1 && segKey(o.a, L) === segKey(m.a, L))).forEach(m => ids.add(m.id));
      return ids;
    };
    if (near1.length >= 3 && near1.filter(endAl).length >= 2 && quality(near1) >= 0.85) return keepWithRepeats(near1);
    // 2개짜리: 둘 다 단어 끝에서 끝나고, 같은/이웃 줄(줄 끝이 끼면 2줄까지)
    const pairOk = (x, y) => {
      const d = Math.abs(ln(x) - ln(y));
      return endAl(x) && endAl(y) && (d <= 1 || (d <= 2 && (isEnd(x) || isEnd(y)))) && quality([x, y]) >= 0.87;
    };
    for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length; j++) {
      if (pairOk(real[i], real[j])) {
        const list = real.filter(m => m === real[i] || m === real[j] || (pairOk(m, real[i]) || pairOk(m, real[j])));
        return keepWithRepeats(list);
      }
    }
    return null;
  }
  // 반복 판정 키: 1음절은 같은 단어일 때만(사상/환상의 '상'은 라임), 2음절 이상은 같은 글자열
  const segText = m => (m.L === 1 ? pron.words[U[m.a].word].text + '#' + S[m.a].wi : segKey(m.a, m.L));
  for (const g of groups) {
    if (!g.alive) continue;
    g.members.sort((x, y) => members[x].a - members[y].a);
    const seen = new Set();
    for (const mid of g.members) {
      const k = segText(members[mid]);
      if (seen.has(k)) members[mid].repeat = true;
      seen.add(k);
    }
    const kept = validate(g);
    if (!kept) {
      for (const mid of g.members) freeMember(mid);
      g.alive = false;
      continue;
    }
    for (const mid of g.members) if (!kept.has(mid)) freeMember(mid);
    g.members = g.members.filter(mid => kept.has(mid));
  }

  // ── 4) 결과 정리 ──
  const live = groups.filter(g => g.alive && g.members.length);
  // 첫 등장 순서로 번호
  live.sort((x, y) => members[x.members[0]].a - members[y.members[0]].a);
  const outGroups = live.map((g, gi) => {
    const ms = g.members.map(mid => members[mid]);
    const rep = ms[0];
    const vowels = [], rime = [];
    for (let t = 0; t < g.L; t++) { vowels.push(U[rep.a + t].vj); rime.push(compose('ㅇ', U[rep.a + t].vj, U[rep.a + t].c)); }
    const codaSame = ms.every(m => { for (let t = 0; t < g.L; t++) if (U[m.a + t].c !== U[rep.a + t].c) return false; return true; });
    const langs = new Set();
    ms.forEach(m => { for (let t = 0; t < g.L; t++) langs.add(U[m.a + t].lang === 'en' ? 'en' : 'ko'); });
    const endCount = ms.filter(m => U[m.a + g.L - 1].le).length;
    const sameLine = new Set(ms.map(m => U[m.a].n)).size < ms.length;
    const tags = [];
    if (endCount >= 2) tags.push('end');
    if (g.L >= 2) tags.push('multi');
    if (sameLine || ms.some(m => !U[m.a + g.L - 1].le)) tags.push('internal');
    if (!codaSame) tags.push('vowel');
    if (langs.size > 1) tags.push('cross');
    return {
      id: gi, len: g.L, vowels, pattern: vowels.join('-'), rime: rime.join(''), tags,
      members: ms.map(m => ({
        start: m.a, len: m.L, units: Array.from({ length: m.L }, (_, t) => m.a + t), repeat: m.repeat, line: S[m.a].line, ln: S[m.a].ln,
        text: pron.text.slice(S[m.a].src[0], S[m.a + m.L - 1].src[1]),
        pron: Array.from({ length: m.L }, (_, t) => S[m.a + t].ch).join(''),
        src: [S[m.a].src[0], S[m.a + m.L - 1].src[1]],
        lineEnd: U[m.a + m.L - 1].le,
      })),
    };
  });
  // 음절 → 그룹
  const sylGroup = new Int32Array(S.length).fill(-1);
  const sylRepeat = new Uint8Array(S.length);
  const sylMember = new Int32Array(S.length).fill(-1);
  outGroups.forEach(g => g.members.forEach((m, mi) => m.units.forEach(u => { sylGroup[u] = g.id; sylMember[u] = mi; if (m.repeat) sylRepeat[u] = 1; })));
  // 화면 표시용: 같은 단어 안에서 이어지는 삽입모음 음절까지 색을 넓힌다 (flow 의 '플', best 의 '스트')
  const sylColor = Int32Array.from(sylGroup);
  const sylExt = new Uint8Array(S.length);
  outGroups.forEach(g => g.members.forEach((m, mi) => {
    let a = m.units[0], b = m.units[m.units.length - 1];
    while (a - 1 >= 0 && S[a - 1].ep && S[a - 1].word === S[a].word && sylColor[a - 1] < 0) { a--; sylColor[a] = g.id; sylExt[a] = 1; sylMember[a] = mi; }
    while (b + 1 < S.length && S[b + 1].ep && S[b + 1].word === S[b].word && sylColor[b + 1] < 0) { b++; sylColor[b] = g.id; sylExt[b] = 1; sylMember[b] = mi; }
    m.src = [S[a].src[0], S[b].src[1]];
    m.text = pron.text.slice(m.src[0], m.src[1]);
    m.pron = S.slice(a, b + 1).map(x => x.ch).join('');
  }));

  const result = { options: opt, groups: outGroups, sylGroup, sylMember, sylRepeat, sylColor, sylExt, content };
  result.scheme = computeScheme(pron, result);
  result.scores = computeScores(pron, result);
  return result;
}

// ───────────────────────── 끝라임 구조 ─────────────────────────
const SCHEME_NAMES = { AABB: '커플릿(AABB)', ABAB: '교차운(ABAB)', ABBA: '포옹운(ABBA)', AAAA: '모노라임(AAAA)', AAXA: '루바이(AABA)', ABCB: '발라드(ABCB)', XAXA: '발라드(XAXA)' };

function computeScheme(pron, r) {
  const S = pron.syllables;
  const opt = r.options;
  // 각 줄의 끝 음절 = 마지막 실제(삽입모음 아닌) 음절
  const endOf = l => { for (let i = l.syl[l.syl.length - 1]; i >= l.syl[0]; i--) if (!S[i].ep) return i; return l.syl[l.syl.length - 1]; };
  const verses = new Map();
  for (const l of r.content) { if (!verses.has(l.verse)) verses.set(l.verse, []); verses.get(l.verse).push(l); }
  // 두 줄 끝이 라임인가: 같은 그룹이거나, 끝 음절 모음이 같고(0.9 이상) 받침이 비슷함
  const rhymes = (x, y) => {
    const i = endOf(x), j = endOf(y);
    const gi = r.sylGroup[i], gj = r.sylGroup[j];
    if (gi >= 0 && gi === gj) return 2;
    if (vowelSim(S[i].jung, S[j].jung) < 0.9) return 0;
    if (!opt.vowelOnly && codaSim(S[i].jong, S[j].jong) < 0.6) return 0;
    const i2 = i - 1, j2 = j - 1;
    const prev = i2 >= x.syl[0] && j2 >= y.syl[0] ? vowelSim(S[i2].jung, S[j2].jung) : 0;
    // 같은 어미·조사로 끝나는 것(했다/갔다)은 앞 음절 모음까지 맞아야 라임
    if (S[i].orth === S[j].orth && S[i].lang === 'ko' && S[j].lang === 'ko' && prev < 0.9) return 0;
    return prev >= 0.6 ? 2 : 1;
  };
  const lines = [];
  const verseOut = [];
  for (const [v, ls] of verses) {
    const parent = ls.map((_, k) => k);
    const find = k => (parent[k] === k ? k : (parent[k] = find(parent[k])));
    for (let x = 0; x < ls.length; x++) for (let y = x + 1; y < ls.length && y - x <= 3; y++) {
      if (rhymes(ls[x], ls[y])) parent[find(y)] = find(x);
    }
    const size = new Map();
    ls.forEach((_, k) => size.set(find(k), (size.get(find(k)) || 0) + 1));
    const letter = new Map();
    let next = 0;
    const letters = ls.map((_, k) => {
      const root = find(k);
      if (size.get(root) < 2) return 'X';
      if (!letter.has(root)) letter.set(root, String.fromCharCode(65 + (next++ % 26)));
      return letter.get(root);
    });
    ls.forEach((l, k) => lines.push({ line: l.idx, n: l.n, verse: v, letter: letters[k], group: r.sylGroup[endOf(l)], end: endOf(l) }));
    const blocks = [];
    for (let k = 0; k < letters.length; k += 4) {
      const chunk = letters.slice(k, k + 4);
      blocks.push({ from: ls[k].n, pattern: chunk.join(''), name: nameScheme(chunk) });
    }
    verseOut.push({ verse: v, pattern: letters.join(''), blocks });
  }
  return { lines, verses: verseOut };
}

function nameScheme(chunk) {
  if (chunk.length < 4) return '';
  // 문자 정규화 (첫 등장 순서대로 A,B,C)
  const map = new Map(); let n = 0;
  const norm = chunk.map(c => (c === 'X' ? 'X' : (map.has(c) ? map.get(c) : (map.set(c, String.fromCharCode(65 + n++)), map.get(c))))).join('');
  if (SCHEME_NAMES[norm]) return SCHEME_NAMES[norm];
  if (/^AAB?B?$/.test(norm.replace(/X/g, ''))) return '';
  if (norm === 'XXXX') return '끝라임 없음';
  return '자유형';
}

// ───────────────────────── 점수 ─────────────────────────
function computeScores(pron, r) {
  const S = pron.syllables;
  const total = S.length || 1;
  let rhymeU = 0, repeatU = 0, multiU = 0;
  for (let i = 0; i < S.length; i++) {
    if (r.sylGroup[i] < 0) continue;
    if (r.sylRepeat[i]) { repeatU++; continue; }
    rhymeU++;
    if (r.groups[r.sylGroup[i]].len >= 2) multiU++;
  }
  const density = rhymeU / total;
  const multiGroups = r.groups.filter(g => g.len >= 2);
  const multiInst = multiGroups.flatMap(g => g.members.filter(m => !m.repeat));
  const avgLen = multiInst.length ? multiInst.reduce((s, m) => s + m.len, 0) / multiInst.length : 0;
  const top5 = [...r.groups].sort((a, b) => b.len - a.len || b.members.length - a.members.length).slice(0, 5)
    .map(g => ({ id: g.id, len: g.len, pattern: g.pattern, rime: g.rime, texts: g.members.filter(m => !m.repeat).map(m => m.text) }));

  // 줄별·절별 밀도
  const perLine = r.content.map(l => {
    let u = 0;
    l.syl.forEach(i => { if (r.sylGroup[i] >= 0 && !r.sylRepeat[i]) u++; });
    return { line: l.idx, n: l.n, verse: l.verse, units: l.syl.length, rhyme: u, density: l.syl.length ? u / l.syl.length : 0 };
  });
  const perVerse = [];
  perLine.forEach(p => {
    let v = perVerse.find(x => x.verse === p.verse);
    if (!v) perVerse.push(v = { verse: p.verse, units: 0, rhyme: 0, lines: 0 });
    v.units += p.units; v.rhyme += p.rhyme; v.lines++;
  });
  perVerse.forEach(v => { v.density = v.units ? v.rhyme / v.units : 0; });

  const lines = r.content.length || 1;
  const endRhymed = r.scheme.lines.filter(l => l.letter !== 'X').length;
  const keys = new Set(r.groups.map(g => g.vowels.map(canon).join('')));
  const repeatRatio = repeatU / ((rhymeU + repeatU) || 1);
  const dens30 = Math.min(1, density / 0.3); // 라임이 적으면 다양성·반복 점수도 줄인다

  const parts = [
    { key: 'density', label: '라임 밀도', max: 40, value: 40 * Math.min(1, density / 0.45), basis: `라임 음절 ${rhymeU} / 전체 ${S.length} = ${(density * 100).toFixed(1)}% (45% 이상 만점)` },
    { key: 'multi', label: '다음절 라임', max: 25, value: 15 * Math.min(1, (multiU / total) / 0.25) + 10 * Math.min(1, Math.max(0, avgLen - 1) / 2), basis: `다음절 음절 비율 ${((multiU / total) * 100).toFixed(1)}% (25% 만점, 15점) + 평균 길이 ${avgLen.toFixed(2)}음절 (3음절 만점, 10점)` },
    { key: 'end', label: '끝라임', max: 15, value: 15 * (endRhymed / lines), basis: `끝라임이 맞는 줄 ${endRhymed} / ${r.content.length}줄` },
    { key: 'variety', label: '다양성', max: 10, value: 10 * Math.min(1, keys.size / Math.max(3, lines * 0.6)) * dens30, basis: `서로 다른 모음 패턴 ${keys.size}개 (줄 수 × 0.6 = ${Math.max(3, lines * 0.6).toFixed(1)}개 만점)${dens30 < 1 ? ` × 밀도 보정 ${dens30.toFixed(2)}` : ''}` },
    { key: 'original', label: '반복 회피', max: 10, value: 10 * (1 - Math.min(1, repeatRatio * 2)) * dens30, basis: `같은 말 반복 음절 ${repeatU}개 (라임 대비 ${(repeatRatio * 100).toFixed(0)}%, 50% 이상이면 0점)${dens30 < 1 ? ` × 밀도 보정 ${dens30.toFixed(2)}` : ''}` },
  ];
  parts.forEach(p => { p.value = Math.round(p.value * 10) / 10; });
  const totalScore = Math.round(parts.reduce((s, p) => s + p.value, 0));
  return {
    total: totalScore, parts, density, rhymeUnits: rhymeU, repeatUnits: repeatU, totalUnits: S.length,
    multiCount: multiInst.length, multiGroups: multiGroups.length, avgLen, top5, perLine, perVerse,
    grade: totalScore >= 85 ? 'S' : totalScore >= 70 ? 'A' : totalScore >= 55 ? 'B' : totalScore >= 40 ? 'C' : 'D',
  };
}

// ───────────────────────── 디버그 출력 ─────────────────────────
export function describeGroups(pron, r) {
  const TAG = { end: '끝라임', multi: '다음절', internal: '내부', vowel: '모음라임', cross: '한영' };
  return r.groups.map(g => `#${g.id + 1} [${g.pattern}] ${g.len}음절 (${g.tags.map(t => TAG[t]).join('·')}): ` +
    g.members.map(m => `${m.text}${m.repeat ? '(반복)' : ''}`).join(' / '));
}
