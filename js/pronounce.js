// 라임 스캐너 — 발음 변환기
// 모든 가사를 "음절 단위 발음 표기"로 통일한다.
//   1) 토큰 분리 (줄 / 단어 / 한글·영어·숫자·기호 조각)
//   2) 표기 변환 (영어 → 한글 음차, 숫자·기호 → 읽는 소리)
//   3) 한국어 음운 규칙 (연음, 비음화, 유음화, 경음화, 격음화, 구개음화, 7대표음)
//   4) 음절 배열 생성 (모음·받침·원문 위치)
import { compose, decompose, applyPhonology } from './pron/hangul.js';
import { SYMBOL_READ, readNumberPart } from './pron/numbers.js';
import { englishToHangul, englishRhymeTail } from './pron/english.js';

// 다른 모듈이 한곳에서 가져다 쓸 수 있게 다시 내보낸다
export { CHO, JUNG, JONG, isHangulSyllable, decompose, compose, applyPhonology } from './pron/hangul.js';
export { readSino, readNative, readEnglishNumber } from './pron/numbers.js';
export { phonesToHangul, arpabetToHangul, englishG2P, englishToHangul, spellLetters, markEp, setEnglishDictionary, getEnglishDictionary, loadEnglishData, englishRhymeTail } from './pron/english.js';

// ───────────────────────── 토큰화 ─────────────────────────
const RE_HANGUL = /[가-힣]/;
const RE_LATIN = /[A-Za-z]/;
const RE_DIGIT = /[0-9]/;
// 머리말 줄: [Verse 1: 이름] 처럼 대괄호 안이면 뒤에 무엇이 와도 되고,
// 괄호·맨 글자는 "(Hook)", "훅 2", "Verse:" 처럼 이름과 번호만 있을 때만 (가사 "(훅 가버려)"는 가사로 본다)
const HEADER_KW = '(?:verse|chorus|hook|bridge|intro|outro|pre-?chorus|pre-?hook|refrain|interlude|훅|벌스|코러스|후렴|인트로|아웃트로|브릿지|브리지|간주)';
const HEADER_BRACKET = new RegExp(`^\\s*[\\[【]\\s*${HEADER_KW}[^\\]】]*[\\]】]\\s*:?\\s*$`, 'i');
const HEADER_PLAIN = new RegExp(`^\\s*[(（]?\\s*${HEADER_KW}\\s*\\d*\\s*[)）]?\\s*:?\\s*$`, 'i');
const HEADER_RE = { test: t => HEADER_BRACKET.test(t) || HEADER_PLAIN.test(t) };

// 한 줄을 단어(소리 나는 조각이 이어진 덩어리)로 나눈다
function splitWords(line, offset) {
  const words = [];
  let cur = null;
  const flush = () => { if (cur && cur.parts.length) words.push(cur); cur = null; };
  let i = 0;
  const L = line.length;
  while (i < L) {
    const ch = line[i];
    let type = null, j = i + 1;
    if (RE_HANGUL.test(ch)) {
      type = 'ko';
      while (j < L && RE_HANGUL.test(line[j])) j++;
    } else if (RE_LATIN.test(ch) || ((ch === "'" || ch === '’') && RE_LATIN.test(line[i + 1] || '') && /^(cause|cuz|em|til|bout|round|fore)/i.test(line.slice(i + 1)))) {
      type = 'en';
      while (j < L && (RE_LATIN.test(line[j]) || ((line[j] === "'" || line[j] === '’') && (RE_LATIN.test(line[j + 1] || '') || /in$/i.test(line.slice(i, j)))) || (line[j] === '$' && RE_LATIN.test(line[j + 1] || '') ))) j++;
    } else if (ch === '$' && RE_LATIN.test(line[i + 1] || '') && i > 0 && RE_LATIN.test(line[i - 1])) {
      type = 'en';
    } else if (RE_DIGIT.test(ch)) {
      type = 'num';
      while (j < L && (RE_DIGIT.test(line[j]) || ((line[j] === '.' || line[j] === ',' || line[j] === '/') && RE_DIGIT.test(line[j + 1] || '')))) j++;
    } else if (SYMBOL_READ[ch]) {
      type = 'sym';
    }
    if (type) {
      if (!cur) cur = { parts: [] };
      // 영어 단어 사이 하이픈/공백 없는 'rock'n'roll' 등은 한 조각
      cur.parts.push({ type, text: line.slice(i, j), start: offset + i, end: offset + j });
      i = j;
      continue;
    }
    // 소리 없는 문자 → 단어 경계
    flush();
    i++;
  }
  flush();
  // 24/7 같은 특수 표기
  return words;
}

// ───────────────────────── 메인: 가사 → 음절 배열 ─────────────────────────
/**
 * @param {string} text
 * @param {{overrides?: Map<string,string>, debug?: boolean, logger?: (title:string, rows:any)=>void}} opts
 * @returns {{text:string, lines:Array, words:Array, syllables:Array, verses:number}}
 */
export function analyzePronunciation(text, opts = {}) {
  const overrides = opts.overrides || new Map();
  const log = opts.debug ? (opts.logger || defaultLogger) : null;
  const lines = [];
  const words = [];
  const syllables = [];
  let verse = 0, lineNo = 0, offset = 0, prevBlank = true;
  const rawLines = text.split('\n');
  for (const raw of rawLines) {
    const start = offset;
    offset += raw.length + 1;
    const trimmed = raw.trim();
    if (!trimmed) { if (!prevBlank) verse++; prevBlank = true; lines.push({ idx: lines.length, start, end: start + raw.length, text: raw, blank: true, words: [], syl: [] }); continue; }
    if (HEADER_RE.test(trimmed)) {
      if (!prevBlank) verse++;
      prevBlank = true;
      lines.push({ idx: lines.length, start, end: start + raw.length, text: raw, header: true, words: [], syl: [] });
      continue;
    }
    prevBlank = false;
    const line = { idx: lines.length, n: lineNo++, verse, start, end: start + raw.length, text: raw, words: [], syl: [] };
    lines.push(line);
    const ws = splitWords(raw, start);
    for (const w of ws) {
      const word = convertWord(w, overrides);
      word.idx = words.length;
      word.line = line.idx;
      words.push(word);
      line.words.push(word.idx);
      word.syl.forEach((s, k) => {
        s.i = syllables.length; s.line = line.idx; s.ln = line.n; s.verse = verse; s.word = word.idx; s.wi = k; s.wn = word.syl.length;
        syllables.push(s);
        line.syl.push(s.i);
      });
    }
  }
  if (log) debugLog(log, lines, words, syllables);
  return { text, lines, words, syllables, verses: verse + 1 };
}

// 단어 하나 변환: 조각별 표기 → 음운 규칙 → 음절
function convertWord(w, overrides) {
  const text = w.parts.map(p => p.text).join('');
  const key = text.toLowerCase();
  const word = { text, start: w.parts[0].start, end: w.parts[w.parts.length - 1].end, parts: w.parts, syl: [], orth: '', lang: '' };
  let units = []; // 표기 음절 {cho,jung,jong,ep,tail,src,lang,orthCh}
  const langs = new Set();
  if (overrides.has(key) && !/^[a-z']+$/.test(key)) {
    // 사용자 지정 발음 (단어 전체)
    const orth = overrides.get(key);
    units = parseOrth(orth, word.start, word.end, text, 'user', /^[a-z']+$/.test(key));
    langs.add('user');
  } else {
    w.parts.forEach((p, pi) => {
      const prev = w.parts[pi - 1], next = w.parts[pi + 1];
      if (p.type === 'ko') {
        langs.add('ko');
        for (let k = 0; k < p.text.length; k++) {
          const d = decompose(p.text[k]);
          units.push({ ...d, src: [p.start + k, p.start + k + 1], lang: 'ko', orthCh: p.text[k] });
        }
      } else if (p.type === 'en') {
        langs.add('en');
        const r = englishToHangul(p.text, overrides);
        p.orth = r.orth; p.how = r.src;
        const enUnits = parseOrth(r.orth, p.start, p.end, p.text, 'en', true);
        // 영어끼리의 라임 판정용: 단어의 마지막 실제 음절에 운 꼬리를 달아 둔다 (real=리얼 과 feel=필 은 꼬리 IY.L 이 같다)
        const tail = r.key && englishRhymeTail(r.key);
        if (tail) { for (let k = enUnits.length - 1; k >= 0; k--) if (!enUnits[k].ep) { enUnits[k].rt = tail; break; } }
        units.push(...enUnits);
      } else if (p.type === 'num') {
        langs.add('num');
        const orth = readNumberPart(p, prev, next);
        p.orth = orth;
        units.push(...parseOrth(orth, p.start, p.end, p.text, 'num', false));
      } else if (p.type === 'sym') {
        langs.add('sym');
        let orth = SYMBOL_READ[p.text] || '';
        if (p.text === '%' && prev && prev.type === 'num') orth = '퍼센트';
        p.orth = orth;
        units.push(...parseOrth(orth, p.start, p.end, p.text, 'sym', false));
      }
    });
  }
  word.lang = langs.size === 1 ? [...langs][0] : 'mix';
  word.orth = units.map(u => (u.tail ? compose(u.cho, u.jung, '') + compose('ㅇ', 'ㅜ', u.jong) : compose(u.cho, u.jung, u.jong))).join('');
  // 음운 규칙 적용 (복사본)
  const pron = units.map(u => ({ cho: u.cho, jung: u.jung, jong: u.jong, en: u.lang === 'en' }));
  applyPhonology(pron);
  // 활음이 붙은 영어 음절 표시: 로+우 → 로우, 소+울 → 소울
  const show = (cho, jung, jong, tail) => (tail ? compose(cho, jung, '') + compose('ㅇ', 'ㅜ', jong) : compose(cho, jung, jong));
  word.syl = units.map((u, k) => {
    const p = pron[k];
    const dj = p.disp ? decompose(p.disp).jung : p.jung;
    return {
      ch: show(p.cho, dj, p.jong, u.tail),
      orth: show(u.cho, u.jung, u.jong, u.tail),
      cho: p.cho, jung: p.jung, jong: p.jong,
      ep: !!u.ep, lang: u.lang, src: u.src, rt: u.rt || null,
    };
  });
  word.pron = word.syl.map(s => s.ch).join('');
  return word;
}

// "플'로우" 같은 표기 → 음절 단위 (원문 글자 범위 배분 포함)
function parseOrth(orth, start, end, srcText, lang, isEnglish) {
  const items = [];
  for (let k = 0; k < orth.length; k++) {
    const ch = orth[k];
    if (ch === "'") { if (items.length) items[items.length - 1].ep = true; continue; }
    const d = decompose(ch);
    if (!d) continue;
    // 영어: '오' 뒤 '우' 활음은 한 음절로 합친다 (flow → 플로우 = 2음절)
    const prev = items[items.length - 1];
    if (isEnglish && prev && !prev.ep && prev.jung === 'ㅗ' && !prev.jong && !prev.tail && d.cho === 'ㅇ' && d.jung === 'ㅜ' && orth[k + 1] !== "'") {
      prev.tail = '우';      // flow=플로우, soul=소울(받침 ㄹ), known=노운
      prev.jong = d.jong;
      continue;
    }
    items.push({ ...d, ep: false, tail: '', lang });
  }
  allocateSpans(items, start, end, srcText, isEnglish);
  return items;
}

// 영어 단어 글자를 음절에 배분 (모음 글자 묶음을 기준점으로)
function vowelGroups(lw) {
  const g = [];
  const isVowelAt = (k) => 'aeiou'.includes(lw[k]) || (lw[k] === 'y' && k > 0);
  let i = 0;
  while (i < lw.length) {
    if (isVowelAt(i) && !(lw[i] === 'y' && 'aeiou'.includes(lw[i + 1] || ''))) {
      let j = i + 1;
      while (j < lw.length && isVowelAt(j)) j++;
      g.push([i, j]);
      i = j;
    } else i++;
  }
  if (g.length > 1) {
    const last = g[g.length - 1], tail = lw.slice(last[0]);
    if (tail === 'e' || tail === 'ed' || (tail === 'es' && !/(s|z|x|sh|ch|g|c)es$/.test(lw))) g.pop();
  }
  return g;
}

function allocateSpans(items, start, end, srcText, isEnglish) {
  const n = items.length;
  const len = end - start;
  if (!n) return;
  if (n === 1) { items[0].src = [start, end]; return; }
  let cuts = null;
  if (isEnglish) {
    const groups = vowelGroups(srcText.toLowerCase());
    const real = [];
    items.forEach((it, k) => { if (!it.ep) real.push(k); });
    if (groups.length === real.length && real.length) {
      cuts = new Array(n + 1).fill(null);
      cuts[0] = 0; cuts[n] = len;
      // 실제 음절 시작 = 모음 묶음 바로 앞 자음 1개
      real.forEach((k, gi) => {
        if (k === 0) return;
        const prevEnd = gi ? groups[gi - 1][1] : 0;
        cuts[k] = Math.max(prevEnd, groups[gi][0] - 1, 0);
      });
      // 실제 음절 뒤에 이어지는 삽입모음: 모음 묶음(+받침 1자) 이후부터
      real.forEach((k, gi) => {
        if (k + 1 >= n || !items[k + 1].ep) return;
        let m = 0; for (let t = k + 1; t < n && items[t].ep; t++) m++;
        const nextKnown = gi + 1 < real.length ? cuts[real[gi + 1]] : len;
        const ge = groups[gi][1];
        let c = ge + (items[k].jong ? 1 : 0);
        if (nextKnown - c < m) c = Math.max(ge, nextKnown - m);
        cuts[k + 1] = Math.max(cuts[k] || 0, Math.min(c, nextKnown));
      });
      // 나머지 경계는 보간
      let k = 1;
      while (k < n) {
        if (cuts[k] === null) {
          let j = k; while (cuts[j] === null) j++;
          const a = cuts[k - 1], b = cuts[j];
          for (let t = k; t < j; t++) cuts[t] = Math.round(a + (b - a) * (t - k + 1) / (j - k + 1));
          k = j;
        }
        k++;
      }
      for (let t = 1; t <= n; t++) if (cuts[t] < cuts[t - 1]) cuts[t] = cuts[t - 1];
    }
  }
  if (!cuts) {
    const wts = items.map(it => (it.ep ? 0.55 : 1));
    const tot = wts.reduce((x, y) => x + y, 0);
    cuts = [0];
    let acc = 0;
    wts.forEach(w => { acc += w; cuts.push(Math.round(len * acc / tot)); });
  }
  items.forEach((it, k) => { it.src = [start + cuts[k], start + cuts[k + 1]]; });
}

// ───────────────────────── 디버그 출력 ─────────────────────────
function defaultLogger(title, rows) {
  if (typeof console === 'undefined') return;
  if (console.groupCollapsed && typeof window !== 'undefined') {
    console.groupCollapsed(title);
    if (Array.isArray(rows) && console.table) console.table(rows); else console.log(rows);
    console.groupEnd();
  } else {
    console.log('\n' + title);
    if (Array.isArray(rows)) rows.forEach(r => console.log('  ' + (typeof r === 'string' ? r : JSON.stringify(r)))); else console.log(rows);
  }
}

function debugLog(log, lines, words, syllables) {
  const content = lines.filter(l => !l.blank && !l.header);
  log('① 토큰 분리 (줄 → 단어 → 조각)', content.map(l => `L${l.n + 1}: ` + l.words.map(wi => words[wi].parts.map(p => `${p.text}<${p.type}>`).join('+')).join(' | ')));
  log('② 표기 변환 (영어 음차·숫자·기호 → 한글)', content.map(l => `L${l.n + 1}: ` + l.words.map(wi => {
    const w = words[wi];
    const ens = w.parts.filter(p => p.orth !== undefined).map(p => `${p.text}→${p.orth}${p.how ? '(' + p.how + ')' : ''}`);
    return ens.length ? `${w.text}[${ens.join(',')}]` : w.text;
  }).join(' ')));
  log('③ 음운 규칙 적용 (표기 → 발음)', content.map(l => `L${l.n + 1}: ` + l.words.map(wi => {
    const w = words[wi];
    return w.orth === w.pron ? w.pron : `${w.orth}→[${w.pron}]`;
  }).join(' ')));
  log('④ 음절 배열 (발음 / 모음 / 받침, *=삽입모음)', content.map(l => `L${l.n + 1}: ` + l.syl.map(i => {
    const s = syllables[i];
    return `${s.ch}${s.ep ? '*' : ''}(${s.jung}${s.jong ? '/' + s.jong : ''})`;
  }).join(' ')));
}

// 단어(또는 짧은 구)의 발음 음절만 빠르게 얻기 (추천 검색용)
export function pronounceWord(text, overrides) {
  const r = analyzePronunciation(text, { overrides });
  return r.syllables;
}
