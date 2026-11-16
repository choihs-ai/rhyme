// 라임 스캐너 — 라임 판정·그룹화·점수 계산
import { JUNG, compose, decompose } from './pronounce.js';

// ───────────────────────── 유사도 ─────────────────────────
// 같은 소리 취급 그룹 (0.9)
const SAME = [['ㅐ', 'ㅔ'], ['ㅙ', 'ㅚ', 'ㅞ'], ['ㅒ', 'ㅖ']];
// 비슷한 소리 (0.6)
const SIMILAR = [['ㅓ', 'ㅗ'], ['ㅡ', 'ㅜ']];
// 반모음(y, w)을 뗀 모음 핵: 봐→ㅏ, 여→ㅓ, 위→ㅣ. 라임은 모음 핵과 받침으로 듣기 때문에
// 반모음만 다른 소리(봐/가, you/true)는 거의 같은 소리로 본다.
const NUCLEUS = { 'ㅑ': 'ㅏ', 'ㅘ': 'ㅏ', 'ㅕ': 'ㅓ', 'ㅝ': 'ㅓ', 'ㅛ': 'ㅗ', 'ㅠ': 'ㅜ', 'ㅒ': 'ㅐ', 'ㅖ': 'ㅔ', 'ㅙ': 'ㅐ', 'ㅞ': 'ㅔ', 'ㅚ': 'ㅔ', 'ㅟ': 'ㅣ', 'ㅢ': 'ㅣ' };
const GLIDE_FACTOR = 0.9;

function plainVowelSim(a, b) {
  if (a === b) return 1;
  for (const g of SAME) if (g.includes(a) && g.includes(b)) return 0.9;
  for (const [x, y] of SIMILAR) if ((a === x && b === y) || (a === y && b === x)) return 0.6;
  return 0;
}
export function vowelSim(a, b) {
  const direct = plainVowelSim(a, b);
  if (direct >= 0.9) return direct;
  const na = NUCLEUS[a] || a, nb = NUCLEUS[b] || b;
  if (na === a && nb === b) return direct;
  return Math.max(direct, GLIDE_FACTOR * plainVowelSim(na, nb));
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

// ───────────────────────── 조사·어미 ─────────────────────────
// 한국어 기본어 사전 (앱이 사전을 불러오면 setLexicon 으로 채운다)
let LEXICON = new Set();
export function setLexicon(words) { LEXICON = words instanceof Set ? words : new Set(words); }
// data/ko-words.json 의 기본어(| 앞)만 모은다 — 활용형(가는, 좋니)은 넣지 않는다
export function lexiconFromKo(ko) {
  const set = new Set();
  for (const v of Object.values(ko.idx || {})) for (const w of v.split('|')[0].split(' ')) if (w) set.add(w);
  return set;
}
// 단어 끝에 붙는 조사·어미. 두 구간의 같은 자리가 모두 조사·어미면 라임의 근거로 세지 않는다
// (분다/운다 는 '분/운' 으로, 바람이/사람이 는 '바람/사람' 으로 판정). 문법 때문에 저절로 같아지는 소리이기 때문.
// '어/아/해' 계열 어미는 한국어 랩 라임의 핵심이라 넣지 않았다 (없어/걸어).
const ENDING_1 = new Set('은 는 을 를 이 가 에 의 도 만 와 과 로 고 서 면 다 요 지 게 며 니 까 께 랑 든 던 죠 네 데 음 기 여 한 할 된 될'.split(' '));
const ENDING_N = ['에서도', '으로도', '습니다', '입니다', '니다', '니까', '는데', '은데', '지만', '에서', '에게', '에도', '에는', '한테', '으로', '까지', '부터', '처럼', '라고', '이라', '이다', '다가', '면서', '으면', '이나', '이랑', '이고', '이야', '거야', '는게', '는걸'];
const PRE_FINAL = new Set(['었', '았', '였', '겠']);   // 선어말어미: 먹|었|다
// 어간에 녹아든 선어말어미도 어미로 본다: 내렸|다(리+었), 합|니다(하+ㅂ니다)
const fusedPreFinal = (ch, next) => {
  if (PRE_FINAL.has(ch)) return true;
  const d = decompose(ch);
  return !!d && (d.jong === 'ㅆ' || (d.jong === 'ㅂ' && next === '니'));
};

// 영어 기능어: 한국어의 조사처럼 문법 때문에 반복되는 말이라 같은 취급을 한다 (the / a / of ...)
const EN_FUNCTION = new Set('the a an of to and or is are was were be am it in on at for with from by as that this'.split(' '));
// 한국어에서 같은 구실을 하는 한 음절 낱말 (의존명사·정도부사). 대명사(난, 내)는 라임에 자주 쓰여 넣지 않았다.
const KO_FUNCTION = new Set(['것', '수', '좀', '더', '또']);

// 각 음절이 조사·어미(또는 영어 기능어)인지 표시한다. 사전에 실린 낱말(종이, 태도, 절대로)은 통째로 실질어로 본다.
function markEndings(pron) {
  const flag = new Uint8Array(pron.syllables.length);
  for (const w of pron.words) {
    const syl = w.syl;
    if (w.lang === 'en' && EN_FUNCTION.has(w.text.toLowerCase())) { for (const x of syl) flag[x.i] = 1; continue; }
    if (syl.length === 1 && syl[0].lang === 'ko' && KO_FUNCTION.has(syl[0].orth)) flag[syl[0].i] = 1;
    if (syl.length < 2 || LEXICON.has(w.text)) continue;
    // 단어 끝의 한글 부분만 본다 (swag은 → '은')
    let from = syl.length;
    while (from > 0 && syl[from - 1].lang === 'ko') from--;
    const tail = syl.slice(from).map(s => s.orth).join('');
    if (!tail) continue;
    const keep = from === 0 ? 1 : 0;                   // 순한글 단어는 어간을 한 음절 이상 남긴다
    let n = 0;
    for (const e of ENDING_N) if (e.length > n && tail.endsWith(e) && tail.length - e.length >= keep) n = e.length;
    if (!n && ENDING_1.has(tail[tail.length - 1]) && tail.length - 1 >= keep) n = 1;
    if (n && tail.length - n - 1 >= keep && fusedPreFinal(tail[tail.length - n - 1], tail[tail.length - n])) n++;
    // 사전에 실린 낱말 + 꼬리(자랑|이라며, 도시|에서부터): 목록에 없는 긴 어미도 낱말 뒤는 통째로 어미로 본다
    if (from === 0 && tail.length >= 3 && ENDING_1.has(tail[tail.length - 1])) {
      for (let stem = tail.length - 1; stem >= 2; stem--) {
        if (tail.length - stem > 3) continue;
        if (LEXICON.has(tail.slice(0, stem))) { n = Math.max(n, tail.length - stem); break; }
      }
    }
    if (!n) continue;
    for (let k = syl.length - n; k < syl.length; k++) flag[syl[k].i] = 1;
  }
  return flag;
}
const isLexical = w => LEXICON.has(w.text) || LEXICON.has(w.orth);

// ───────────────────────── 영어 운 꼬리 ─────────────────────────
// 영어 단어끼리는 영어 발음이 기준이다. 운 꼬리의 마지막 모음이 다르면(milk IH / office AH) 한글 표기가 닮아도 약하게 본다.
// 한글로 옮기면 합쳐지고 영어로도 가까운 모음만 같은 부류로 묶는다.
const EN_VOWEL_CLASS = { AA: 'a', AO: 'a', AH: 'ə', ER: 'ə', IH: 'i', IY: 'i', UH: 'u', UW: 'u', AE: 'AE', EH: 'EH', AY: 'AY', AW: 'AW', EY: 'EY', OY: 'OY', OW: 'OW' };
// 강세 없는 끝 음절(jacket 의 -ket)은 끝소리까지 같아야 라임으로 들린다. 유성/무성, 비음 차이는 같은 소리로 접는다.
const EN_CODA_CLASS = { M: 'N', N: 'N', NG: 'N', D: 'T', G: 'K', B: 'P', Z: 'S', V: 'F', ZH: 'SH', JH: 'CH', DH: 'TH' };
// 운 꼬리 → { cls: 마지막 모음 부류, fin: 마지막 모음부터의 끝소리, stressed: 그 모음이 강세 모음인가 }
function tailInfo(tail) {
  if (!tail) return null;
  const ph = tail.split('.');
  for (let i = ph.length - 1; i >= 0; i--) {
    const cls = EN_VOWEL_CLASS[ph[i]];
    if (cls) return { cls, fin: cls + '.' + ph.slice(i + 1).map(p => EN_CODA_CLASS[p] || p).join('.'), stressed: i === 0 };
  }
  return null;
}

// ───────────────────────── 옵션 ─────────────────────────
export const DEFAULT_OPTIONS = { vowelOnly: true, minLen: 1, sensitivity: 50, maxLen: 8 };

function params(opt) {
  const t = Math.max(0, Math.min(100, opt.sensitivity)) / 100;
  return {
    T: 0.92 - 0.3 * t,                  // 유사도 하한 (민감도 50 → 0.77)
    minV: t < 0.25 ? 0.9 : 0.6,          // 음절별 모음 유사도 하한
    W: L => (L === 1 ? (t >= 0.7 ? 1 : 0) : L === 2 ? Math.round(2 + 2 * t) : L === 3 ? Math.round(4 + 4 * t) : Math.round(8 + 8 * t)),
    W1end: 3,                            // 1음절 끝라임 거리 (AABB·ABAB·ABBA)
  };
}

// ───────────────────────── 분석 ─────────────────────────
/**
 * @param pron analyzePronunciation() 결과
 * @param options {vowelOnly, minLen, sensitivity, maxLen, exclude}
 */
export function analyzeRhymes(pron, options = {}) {
  const opt = { ...DEFAULT_OPTIONS, ...options };
  const P = params(opt);
  const S = pron.syllables;
  const content = pron.lines.filter(l => !l.blank && !l.header && l.syl.length);
  const lineRange = new Map(content.map(l => [l.idx, [l.syl[0], l.syl[l.syl.length - 1] + 1]]));
  const ending = markEndings(pron);

  // 뒤(앞)에 같은 단어의 '소리 없는 꼬리'만 남으면 단어 끝(시작)으로 본다.
  //   road=로+드(삽입모음) → '로'가 단어 끝,  거짓말은 → '말'이 단어 끝(조사 '은' 앞)
  const onlyAfter = (i, lim, same, skip) => { for (let k = i + 1; k < lim; k++) { if (!same(k)) return true; if (!skip(k)) return false; } return true; };
  const onlyBefore = (i, lim, same, skip) => { for (let k = i - 1; k >= lim; k--) { if (!same(k)) return true; if (!skip(k)) return false; } return true; };
  // 음절 단위 정보
  const U = S.map((s, i) => {
    const w = pron.words[s.word];
    const [la, lb] = lineRange.get(s.line);
    const sameWord = k => S[k].word === s.word;
    return {
      i, v: VIDX[s.jung], vj: s.jung, c: s.jong, o: s.cho, ep: s.ep, n: s.ln, verse: s.verse, line: s.line,
      ws: onlyBefore(i, la, sameWord, k => S[k].ep),
      we: onlyAfter(i, lb, sameWord, k => S[k].ep),                          // 어절 끝
      stemEnd: !ending[i] && onlyAfter(i, lb, sameWord, k => S[k].ep || ending[k]),  // 조사·어미 바로 앞 (어간 끝)
      le: onlyAfter(i, lb, () => true, k => S[k].ep), ls: i === la,
      gram: !!ending[i], rt: s.rt || null, en: tailInfo(s.rt),
      key: s.lang === 'ko' ? s.orth : `${w.text.toLowerCase()}#${s.wi}`, wkey: `${w.text.toLowerCase()}#${s.wi}`, lang: s.lang, word: s.word,
    };
  });

  // 두 음절의 모음·받침 유사도 (영어 운 꼬리·삽입모음 반영)
  const pairV = (x, y) => {
    if (x.rt && x.rt === y.rt) return 1;            // 영어 단어끼리 운 꼬리가 같음 (real/feel)
    const v = VS[x.v][y.v];
    if (x.ep !== y.ep) return v * 0.6;               // 삽입모음 ↔ 실제 모음은 약하게
    if (x.en && y.en) {
      if (x.en.cls !== y.en.cls) return v * 0.6;                                       // 영어끼리인데 영어 모음이 다름 (go/law)
      if (!(x.en.stressed && y.en.stressed) && x.en.fin !== y.en.fin) return v * 0.6;  // 강세 없는 끝 음절인데 끝소리가 다름 (jacket/office)
    }
    return x.ep ? v * 0.9 : v;
  };
  const pairC = (x, y) => (x.rt && x.rt === y.rt ? 1 : codaSim(x.c, y.c));

  // 두 구간 비교. 양쪽이 모두 조사·어미인 자리는 소리가 맞아야 하지만 점수(근거)에는 넣지 않는다.
  //   eff = 근거가 되는 음절 수
  //   q   = 판정에 쓰는 품질. '모음만 같아도 인정'이면 모음이 다 맞을 때 받침 차이를 눈감아 준다 (약속/악몽)
  function compare(a, b, L) {
    // 줄 끝끼리가 아니면 한쪽만 조사·어미인 자리는 소리 비교에는 넣되 근거 음절로는 세지 않는다.
    //   너의/머니 의 '의/니' 는 맞는 소리지만, 버스/것을 처럼 그것만으로 2음절 라임이 되지는 않는다.
    const lineEnd = U[a + L - 1].le && U[b + L - 1].le;
    let vs = 0, cs = 0, os = 0, eff = 0, cnt = 0, par = 0, epA = true, epB = true, minv = 1, sameWord = 0, epPairs = 0;
    for (let k = 0; k < L; k++) {
      const x = U[a + k], y = U[b + k];
      const v = pairV(x, y);
      if (v < P.minV) return null;
      const c = pairC(x, y);
      if (!opt.vowelOnly && c < 0.6) return null;
      if (L > 1 && x.wkey === y.wkey) sameWord++;
      if (x.ep || y.ep) epPairs++;
      if (!x.ep) epA = false;
      if (!y.ep) epB = false;
      const weak = !lineEnd && (x.gram || y.gram);
      if ((x.gram && y.gram) || weak) {
        if (k === 0) return null;                    // 조사·어미에서 시작하는 구간은 없다
        if (x.gram && y.gram) { par++; continue; }
      }
      if (x.ep && y.ep) continue;                    // 삽입모음끼리는 자음군일 뿐 모음 근거가 아니다
      vs += v; cs += c; cnt++; if (x.o === y.o) os++;
      if (v < minv) minv = v;
      if (!weak) eff++;
    }
    if (epA || epB || !eff) return null;
    if (sameWord && sameWord < L) return null;    // 같은 단어가 섞인 구간 (내 방 / 내 사상)
    if (epPairs > (L === 2 ? 1 : Math.floor((L - 1) / 2))) return null; // 삽입모음 위주 일치 제외
    const sim = (vs * W_VOWEL + cs * W_CODA) / cnt, v = vs / cnt;
    // par = 양쪽에 같은 조사·어미가 붙은 자리 수 (가고/남고 의 '고')
    return { sim, v, c: cs / cnt, o: os / cnt, minv, eff, par, vq: opt.vowelOnly ? Math.max(sim, v - 0.05) : sim };
  }
  // 판정 품질: 줄 끝끼리는 자리 자체가 강한 근거라 모음만 맞아도 인정하고, 줄 안쪽은 받침도 닮아야 한다
  const qual = (m, bothLineEnd) => (bothLineEnd ? m.vq : m.sim);
  // 구간이 단어 경계에서 끝나는가: 어절 끝이거나, 단어 첫머리에서 시작해 어간 끝에서 끝남 (갈망|한, 거짓말|은)
  const endsWord = (a, L) => U[a + L - 1].we || (U[a + L - 1].stemEnd && U[a].ws);
  const segKey = (a, L) => { let k = ''; for (let t = 0; t < L; t++) k += U[a + t].key + '|'; return k; };
  // 같은 말의 반복인가: 조사·어미를 뺀 글자의 60% 넘게 같으면 라임이 아니라 반복 (인조이라는게/인조이하는게).
  //   바람이/사람이 는 조사 '이'를 빼면 절반만 같으므로 라임.
  const nearSame = (a, b, L) => {
    // 두 구간이 단어 안 같은 자리에서 시작하면 단어 첫머리까지 넓혀서 본다 (인조이|라는게 / 인조이|하는게)
    if (S[a].wi === S[b].wi && S[a].wi > 0) { const back = S[a].wi; a -= back; b -= back; L += back; }
    let same = 0, n = 0, all = true;
    for (let t = 0; t < L; t++) {
      const eq = U[a + t].key === U[b + t].key;
      if (!eq) all = false;
      if (U[a + t].gram && U[b + t].gram) continue;
      n++; if (eq) same++;
    }
    if (all) return true;
    return n >= 2 && same / n > 0.6;
  };
  // 사용자가 '라임 아님'으로 뺀 구간: 줄 내용 + 줄 안 글자 위치로 식별 (그 줄을 고치면 자동으로 풀림)
  const EX = opt.exclude instanceof Set ? opt.exclude : new Set(opt.exclude || []);
  const exHit = new Set();
  const spanKey = (a, L) => { const ln = pron.lines[S[a].line]; return `${ln.text.trim()}|${S[a].src[0] - ln.start}|${S[a + L - 1].src[1] - ln.start}`; };
  const excluded = (a, L) => { if (!EX.size) return false; const k = spanKey(a, L); if (EX.has(k)) { exHit.add(k); return true; } return false; };

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
        if (U[a].ep) continue;                            // 라임은 실제 모음에서 시작
        for (let b = (li === lj ? a + 1 : b0); b < b1; b++) {
          if (U[b].ep) continue;
          // 같은 위치에서 시작하는 가장 긴 일치 길이
          let R = 0;
          const lim = Math.min(opt.maxLen, a1 - a, b1 - b, li === lj ? b - a : Infinity);
          while (R < lim && pairV(U[a + R], U[b + R]) >= P.minV) R++;
          const sameVerse = U[a].verse === U[b].verse;
          for (let L = Math.max(1, opt.minLen); L <= R; L++) {
            if (U[a + L - 1].ep || U[b + L - 1].ep) continue;   // 구간은 실제 모음에서 끝난다 (뒤따르는 삽입모음은 표시할 때만 붙인다)
            const m = compare(a, b, L);
            if (!m) continue;
            const n = m.eff;                               // 근거 음절 수로 규칙을 고른다
            if (n <= 3 && !sameVerse) continue;
            const isEnd = U[a + L - 1].le && U[b + L - 1].le;
            const q = qual(m, isEnd);
            const alignEnd = endsWord(a, L) && endsWord(b, L);
            const alignStart = U[a].ws && U[b].ws;
            const fullA = U[a].ws && endsWord(a, L), fullB = U[b].ws && endsWord(b, L);
            // 반복: 1음절은 같은 단어일 때, 그 밖에는 글자가 거의 같을 때
            const repeat = L === 1 ? U[a].wkey === U[b].wkey && pron.words[U[a].word].text === pron.words[U[b].word].text : nearSame(a, b, L);
            if (n === 1) {
              if (m.minv < 0.9) continue;
              if (d > (isEnd ? P.W1end : P.W(1))) continue;
              // 같은 어미를 뗀 어간 한 음절만 근거일 때는 받침까지 닮아야 한다 (분다/운다 ○, 열립니다/예정입니다 ×)
              if (isEnd && m.par > 0 && m.c < 0.6) continue;
              // 줄 안의 1음절: 단어 끝끼리이고 받침이 닮았거나, 같은 어미가 붙은 나란한 꼴(가고/남고)
              if (!isEnd && !(alignEnd && (m.c >= 0.6 || m.par > 0))) continue;
            } else {
              if (d > P.W(n)) continue;
              if (q < P.T + 0.02 * d) continue;          // 멀수록 더 닮아야 함
              if (n === 2 && !(alignEnd || isEnd || (alignStart && (fullA || fullB)))) continue;
              if (n >= 3 && !(alignEnd || isEnd)) continue;  // 3음절 이상은 단어/줄 끝에서 끝나야 함
            }
            if (excluded(a, L) || excluded(b, L)) continue;
            const dist = n === 1 ? (d === 0 ? 1 : 0.85 - 0.1 * (d - 1)) : n === 2 ? (d <= 1 ? 1 : 1 - 0.15 * (d - 1)) : Math.max(0.6, 1 - 0.04 * d);
            // 길이 우선 + 품질(유사도², 단어·줄 끝 정렬) 반영. 어미까지 덮는 구간(운다)이 어간만(운)보다 조금 앞선다.
            const score = Math.pow(n, 1.2) * m.sim * m.sim * (1 + 0.25 * alignEnd + 0.2 * alignStart + 0.6 * isEnd + 0.1 * m.o) * dist * (1 + 0.03 * (L - n));
            // 그룹을 새로 만들 수 있는 '강한 씨앗' 쌍인가
            let seed;
            if (n === 1) seed = isEnd || d === 0;
            else if (isEnd) seed = true;
            else if (n === 2) {
              // 어간 끝(계란|이랑)으로만 맞는 쌍은 같은 줄 안에서만 씨앗이 된다
              const trueEnds = U[a + L - 1].we && U[b + L - 1].we;
              // 조사가 서로 다른 낱말 쌍(사랑|을 / 자랑|이라며)은 어간 전체가 받침까지 거의 같고 이웃한 줄일 때만 씨앗
              const wholeStems = fullA && fullB && d <= 1 && m.sim >= 0.95;
              seed = alignEnd && (wholeStems || (trueEnds && (d <= 1 || (d <= 2 && (U[a + L - 1].le || U[b + L - 1].le))))) && q >= 0.87;
            }
            else seed = alignEnd && ((U[a + L - 1].we && U[b + L - 1].we) || (fullA && fullB && d <= 1 && m.sim >= 0.95)) && q >= 0.85 && (U[a].ws || U[b].ws);
            cands.push({ a, b, L, n, d, par: m.par, sim: m.sim, score, repeat, isEnd, alignEnd, alignStart, seed });
          }
        }
      }
    }
  }
  // 줄 끝 보호: 줄 끝끼리 이미 라임 상대가 있는 음절을, 한쪽만 줄 끝인 후보(꺼진 방 / 멀기만)가 가로채지 못하게
  // 상대 줄 수만큼 점수를 낮춘다. 듣는 사람에게는 줄 끝 라임이 가장 먼저 들리기 때문.
  const endPartners = new Map();
  for (const c of cands) {
    if (!c.isEnd || c.repeat) continue;
    for (const [me, other] of [[c.a + c.L - 1, c.b], [c.b + c.L - 1, c.a]]) {
      if (!endPartners.has(me)) endPartners.set(me, new Set());
      endPartners.get(me).add(U[other].n);
    }
  }
  for (const c of cands) {
    const ea = c.a + c.L - 1, eb = c.b + c.L - 1;
    if (U[ea].le === U[eb].le) continue;
    const partners = endPartners.get(U[ea].le ? ea : eb);
    if (partners) c.score /= 1 + partners.size;
  }
  cands.sort((x, y) => y.score - x.score || y.L - x.L);

  // ── 2) 그룹 형성 (긴 라임 우선) ──
  // 한 그룹의 멤버는 끝을 맞춰 비교한다. 길이는 달라도 된다: "go higher / on fire"(4음절)에 "desire"(3음절)가 꼬리로 합류.
  const owner = new Int32Array(S.length).fill(-1);       // 음절 → 그룹 멤버 id
  const members = [];                                     // {id, a, L, end, g, repeat}
  const groups = [];                                      // {id, members:[mid], alive}
  const isFree = (a, L) => { for (let t = 0; t < L; t++) if (owner[a + t] >= 0) return false; return true; };
  const addMember = (g, a, L) => {
    const id = members.length;
    members.push({ id, a, L, end: a + L - 1, g: g.id, repeat: false });
    for (let t = 0; t < L; t++) owner[a + t] = id;
    g.members.push(id);
    return id;
  };
  // 닻(anchor) = 구간에서 조사·어미를 뺀 마지막 음절. 멤버끼리는 닻을 맞춰 비교한다:
  //   거짓말|은 과 더딘 날|도 는 붙은 조사가 달라도 '말/날'에서 끝나는 같은 라임이다.
  const anchorOf = (a, L) => { for (let i = a + L - 1; i > a; i--) if (!U[i].gram) return i; return a; };
  // 두 구간을 맞춰 놓는다. 뒤에 붙은 조사·어미 수가 같으면 그대로 끝을 맞추고, 다르면 닻까지만 본다.
  const aligned = (a1, L1, a2, L2) => {
    const t1 = a1 + L1 - 1 - anchorOf(a1, L1), t2 = a2 + L2 - 1 - anchorOf(a2, L2);
    if (t1 !== t2) { L1 -= t1; L2 -= t2; }
    const L = Math.min(L1, L2);
    return [a1 + L1 - L, a2 + L2 - L, L];
  };
  // 끝을 맞춘 비교와 닻을 맞춘 비교 중 맞는 쪽을 쓴다 (너의↔머니 는 끝, 거짓말은↔더딘 날 은 닻)
  const compareTails = (a1, L1, a2, L2) => {
    const L = Math.min(L1, L2);
    const byEnd = compare(a1 + L1 - L, a2 + L2 - L, L);
    const [s1, s2, La] = aligned(a1, L1, a2, L2);
    const byAnchor = s1 + La === a1 + L1 && s2 + La === a2 + L2 ? null : compare(s1, s2, La);
    if (!byEnd || !byAnchor) return byEnd || byAnchor;
    return byAnchor.eff > byEnd.eff ? byAnchor : byEnd;
  };
  // 구간이 기존 멤버와 같은 닻에서 끝나고 그보다 길지 않으면 그 멤버.
  // 멤버보다 짧은 꼬리로 붙는 것은 줄 끝 라임끼리이거나, 같은 줄에서 같은 어미가 붙은 나란한 꼴(가고/남고/닳고)일 때만
  // 허용한다 (줄 중간의 짧은 일치가 긴 그룹에 딸려 들어오지 않게).
  const memberWithTail = (a, L, shortOk) => {
    const anchor = anchorOf(a, L);
    const mid = owner[anchor];
    if (mid < 0) return null;
    const m = members[mid];
    if (anchorOf(m.a, m.L) !== anchor || m.a > a) return null;
    if (m.a === a) return m;
    return shortOk && a + L - 1 <= m.end ? m : null;   // 짧은 꼬리는 멤버 안에 온전히 들어 있어야 한다
  };
  const near = (g, a, L, n) => {
    const W = n === 1 ? Math.max(P.W(1), U[a + L - 1].le ? P.W1end : 0) : P.W(n);
    return g.members.some(mid => Math.abs(U[members[mid].a].n - U[a].n) <= W);
  };
  const fits = (g, a, L) => {
    const rep = members[g.members[0]];
    // 단어 끝에서 끝나지 않는 멤버(갈망|한)는 끝라임 그룹에만 합류
    // 단, 단어 첫머리에서 시작하는 멤버(조이|보이가)는 단어 끝이 맞는 멤버가 2개 이상인 그룹에 붙을 수 있다
    if (L > 1 && !endsWord(a, L) && !U[a + L - 1].le) {
      const endAligned = g.members.filter(mid => endsWord(members[mid].a, members[mid].L)).length;
      if (!(U[a].ws && U[a].word === U[a + L - 1].word && endAligned >= 2) && g.members.filter(mid => U[members[mid].end].le).length < 2) return false;
    }
    const m = compareTails(rep.a, rep.L, a, L);
    if (!m) return false;
    if (m.eff === 1) {
      // 줄 안의 한 음절 멤버는 받침이 닮았거나 같은 어미가 붙은 나란한 꼴이어야 한다
      const bothEnd = U[rep.end].le && U[a + L - 1].le;
      return m.minv >= 0.9 && (bothEnd ? !(m.par > 0 && m.c < 0.6) : m.c >= 0.6 || m.par > 0);
    }
    return qual(m, U[rep.end].le && U[a + L - 1].le) >= P.T - 0.05;
  };
  const canonKey = (a, L) => { let k = ''; for (let t = 0; t < L; t++) k += canon(U[a + t].vj); return k; };

  function process(c, allowCreate) {
    const shortOk = c.isEnd || (c.d === 0 && c.par > 0);
    const ma = memberWithTail(c.a, c.L, shortOk), mb = memberWithTail(c.b, c.L, shortOk);
    const ga = ma ? groups[ma.g] : null;
    const gb = mb ? groups[mb.g] : null;
    if (ga && gb) {
      if (ga !== gb && ga.alive && gb.alive) {
        const [sa, sb, L] = aligned(members[ga.members[0]].a, members[ga.members[0]].L, members[gb.members[0]].a, members[gb.members[0]].L);
        if (canonKey(sa, L) === canonKey(sb, L)) {
          for (const mid of gb.members) { members[mid].g = ga.id; ga.members.push(mid); }
          gb.members = []; gb.alive = false;
        }
      }
      return;
    }
    if (ga && isFree(c.b, c.L)) { if (ga.alive && fits(ga, c.b, c.L) && near(ga, c.b, c.L, c.n)) addMember(ga, c.b, c.L); return; }
    if (gb && isFree(c.a, c.L)) { if (gb.alive && fits(gb, c.a, c.L) && near(gb, c.a, c.L, c.n)) addMember(gb, c.a, c.L); return; }
    if (allowCreate && c.seed && !ga && !gb && isFree(c.a, c.L) && isFree(c.b, c.L)) {
      const g = { id: groups.length, members: [], alive: true };
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
  }
  // 대표 멤버와의 평균 품질
  const quality = list => {
    if (list.length < 2) return 0;
    const rep = list[0];
    let sum = 0;
    for (let k = 1; k < list.length; k++) { const m = compareTails(rep.a, rep.L, list[k].a, list[k].L); sum += m ? qual(m, U[rep.end].le && U[list[k].end].le) : 0; }
    return sum / (list.length - 1);
  };
  // 우연한 모음 일치를 걸러낸다: 끝라임 / 3음절 이상 / 가까이 몰린 3개 이상 / 단어 끝이 맞는 가까운 2개
  function validate(g) {
    const M = g.members.map(mid => members[mid]);
    const real = M.filter(m => !m.repeat);
    if (real.length < 2) return null;
    // 그룹의 근거 음절 수 = 멤버 쌍 사이에서 실제로 근거가 된 음절 수의 최댓값 (조사가 섞인 버스/것을 은 1)
    let n = 0;
    for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length; j++) {
      const m = compareTails(real[i].a, real[i].L, real[j].a, real[j].L);
      if (m && m.eff > n) n = m.eff;
    }
    const isEnd = m => U[m.end].le;
    const endAl = m => endsWord(m.a, m.L);
    const ln = m => U[m.a].n;
    const all = new Set(g.members);
    const ends = real.filter(isEnd);
    if (n <= 1) {
      if (ends.length >= 2 || real.length >= 3) return all;
      // 한 줄 안의 두 개: 같은 어미가 붙고 어간 끝의 모음·받침이 모두 같은 닫힌 음절일 때만 (분다/운다).
      // 받침 없는 한 음절이나 어미 없는 낱말끼리(삼/담)는 우연이 너무 많다.
      const [x, y] = real;
      const stem = m => { for (let i = m.end; i >= m.a; i--) if (!U[i].gram) return U[i]; return null; };
      const sx = stem(x), sy = stem(y);
      const inflected = m => m.L > 1 && U[m.end].gram;
      return sx && sy && ln(x) === ln(y) && inflected(x) && inflected(y) && sx.c && pairC(sx, sy) === 1 && pairV(sx, sy) >= 0.9 ? all : null;
    }
    if (ends.length >= 2) return all;
    if (n >= 3 && quality(real) >= 0.85 && real.some(m => U[m.a].ws)) return all;
    // 가까이(1줄 이내) 이웃이 있는 멤버만 남긴다
    const near1 = real.filter(m => real.some(o => o !== m && Math.abs(ln(o) - ln(m)) <= 1));
    const keepWithRepeats = list => {
      const ids = new Set(list.map(m => m.id));
      M.filter(m => m.repeat && list.some(o => Math.abs(ln(o) - ln(m)) <= 1 && o.L === m.L && segKey(o.a, o.L) === segKey(m.a, m.L))).forEach(m => ids.add(m.id));
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
  const nearSameTails = (f, m) => { const [sa, sb, L] = aligned(f.a, f.L, m.a, m.L); return L > 1 && nearSame(sa, sb, L); };
  for (const g of groups) {
    if (!g.alive) continue;
    g.members.sort((x, y) => members[x].a - members[y].a);
    const seen = new Set();
    const firsts = [];
    // 같은 말이 여러 번 나오면 줄 끝에 놓인 것을 원본으로, 나머지를 반복으로 본다
    const order = [...g.members].sort((x, y) => U[members[y].end].le - U[members[x].end].le || members[x].a - members[y].a);
    for (const mid of order) {
      const m = members[mid];
      const k = segText(m);
      if (seen.has(k) || firsts.some(f => nearSameTails(f, m))) m.repeat = true;
      else firsts.push(m);
      seen.add(k);
    }
    // 1음절 그룹이 전부 같은 글자일 때: 사전에 실린 낱말이 끼어 있으면(기억/추억, 시계/세계) 서로 다른 단어끼리의 라임,
    // 하나도 없으면(원투훅/이건훅/너는훅) 같은 말을 붙여 쓴 반복으로 본다.
    const ms = g.members.map(mid => members[mid]);
    if (ms.length && ms.every(m => m.L === 1 && S[m.a].lang === 'ko' && S[m.a].orth === S[ms[0].a].orth)) {
      const anyLexical = ms.some(m => isLexical(pron.words[U[m.a].word]));
      const words = new Set();
      ms.forEach((m, k) => {
        const text = pron.words[U[m.a].word].text;
        m.repeat = anyLexical ? words.has(text) : k > 0;
        words.add(text);
      });
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
    // 대표 = 가장 긴 멤버 (같으면 먼저 나온 것)
    const rep = ms.reduce((best, m) => (m.L > best.L ? m : best), ms[0]);
    const vowels = [], rime = [];
    for (let t = 0; t < rep.L; t++) { vowels.push(U[rep.a + t].vj); rime.push(compose('ㅇ', U[rep.a + t].vj, U[rep.a + t].c)); }
    const codaSame = ms.every(m => { const [sa, sb, L] = aligned(m.a, m.L, rep.a, rep.L); for (let t = 0; t < L; t++) if (U[sa + t].c !== U[sb + t].c) return false; return true; });
    const langs = new Set();
    ms.forEach(m => { for (let t = 0; t < m.L; t++) langs.add(U[m.a + t].lang === 'en' ? 'en' : 'ko'); });
    const endCount = ms.filter(m => U[m.end].le).length;
    const sameLine = new Set(ms.map(m => U[m.a].n)).size < ms.length;
    const tags = [];
    if (endCount >= 2) tags.push('end');
    if (rep.L >= 2) tags.push('multi');
    if (sameLine || ms.some(m => !U[m.end].le)) tags.push('internal');
    if (!codaSame) tags.push('vowel');
    if (langs.size > 1) tags.push('cross');
    return {
      id: gi, len: rep.L, vowels, pattern: vowels.join('-'), rime: rime.join(''), tags,
      members: ms.map(m => ({
        key: spanKey(m.a, m.L),
        start: m.a, len: m.L, units: Array.from({ length: m.L }, (_, t) => m.a + t), repeat: m.repeat, line: S[m.a].line, ln: S[m.a].ln,
        text: pron.text.slice(S[m.a].src[0], S[m.end].src[1]),
        pron: Array.from({ length: m.L }, (_, t) => S[m.a + t].ch).join(''),
        src: [S[m.a].src[0], S[m.end].src[1]],
        lineEnd: U[m.end].le,
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

  const { exclude: _ex, ...plainOpt } = opt;
  const result = { options: plainOpt, excludedKeys: [...exHit], groups: outGroups, sylGroup, sylMember, sylRepeat, sylColor, sylExt, content };
  result.scheme = computeScheme(pron, result, { ending, pairV: (i, j) => pairV(U[i], U[j]), pairC: (i, j) => pairC(U[i], U[j]) });
  result.scores = computeScores(pron, result);
  return result;
}

// ───────────────────────── 끝라임 구조 ─────────────────────────
const SCHEME_NAMES = { AABB: '커플릿(AABB)', ABAB: '교차운(ABAB)', ABBA: '포옹운(ABBA)', AAAA: '모노라임(AAAA)', AAXA: '루바이(AABA)', ABCB: '발라드(ABCB)', XAXA: '발라드(XAXA)' };

function computeScheme(pron, r, { ending, pairV, pairC }) {
  const S = pron.syllables;
  const opt = r.options;
  // 각 줄의 끝 음절 = 마지막 실제(삽입모음 아닌) 음절
  const endOf = l => { for (let i = l.syl[l.syl.length - 1]; i >= l.syl[0]; i--) if (!S[i].ep) return i; return l.syl[l.syl.length - 1]; };
  const verses = new Map();
  for (const l of r.content) { if (!verses.has(l.verse)) verses.set(l.verse, []); verses.get(l.verse).push(l); }
  // 두 줄 끝이 라임인가
  const rhymes = (x, y) => {
    let i = endOf(x), j = endOf(y);
    const gi = r.sylGroup[i], gj = r.sylGroup[j];
    if (gi >= 0 && gi === gj) return true;
    // 양쪽 줄 끝에 같은 소리의 조사·어미가 붙어 있으면 그 앞(어간 끝)을 비교한다: 간다/산다 → 간/산, 갔다/먹는다 → 갇/는
    let stripped = false;
    while (ending[i] && ending[j] && pairV(i, j) >= 0.9 && i > x.syl[0] && j > y.syl[0]) { i--; j--; stripped = true; }
    if (stripped && (ending[i] || ending[j])) return false;
    if (pairV(i, j) < 0.9) return false;
    if (!opt.vowelOnly && pairC(i, j) < 0.6) return false;
    if (stripped) return pairC(i, j) >= 0.6;   // 어간 한 음절만 근거일 때는 받침까지
    // 같은 글자로 끝나는 줄: 앞 음절까지 맞거나, 사전에 실린 낱말이 낀 서로 다른 단어(기억/추억)일 때만 라임
    if (S[i].orth === S[j].orth && S[i].lang === 'ko' && S[j].lang === 'ko') {
      const prev = i > x.syl[0] && j > y.syl[0] ? pairV(i - 1, j - 1) : 0;
      if (prev >= 0.9) return true;
      const wi = pron.words[S[i].word], wj = pron.words[S[j].word];
      return wi.text !== wj.text && (isLexical(wi) || isLexical(wj));
    }
    return true;
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
  for (const g of r.groups) for (const m of g.members) {
    if (m.repeat) { repeatU += m.len; continue; }
    rhymeU += m.len;
    if (m.len >= 2) multiU += m.len;
  }
  const density = rhymeU / total;
  const multiGroups = r.groups.filter(g => g.len >= 2);
  const multiInst = r.groups.flatMap(g => g.members.filter(m => !m.repeat && m.len >= 2));
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
