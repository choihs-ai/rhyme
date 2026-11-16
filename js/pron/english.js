// 영어 단어 → 한국어 발음 음절
//   1) 사전(data/en-words.json: 랩 영어 예외 사전 + CMU 발음 사전 기반 변환)
//   2) 사전 어간 + 접미사 (flexin → flex + in)
//   3) 규칙 기반 글자→음소 변환 (englishG2P) → 음소→한글 (phonesToHangul)
// 결과 문자열에서 삽입모음(원래 영어엔 모음이 없는 음절)은 뒤에 ' 를 붙인다: flow → 플'로우
import { compose, decompose } from './hangul.js';

const LETTER_NAMES = { a:'에이', b:'비', c:'씨', d:'디', e:'이', f:'에프', g:'지', h:'에이치', i:'아이', j:'제이', k:'케이', l:'엘', m:'엠', n:'엔', o:'오', p:'피', q:'큐', r:'알', s:'에스', t:'티', u:'유', v:'브이', w:'더블유', x:'엑스', y:'와이', z:'지' };

// ───────────────────────── 영어 → 한글 음차 ─────────────────────────
// ARPAbet 음소열을 한국어 음절로 바꾼다. 결과 문자열에서 삽입모음(원래 영어엔 모음이 없는 음절)은 뒤에 ' 를 붙인다.
const VOWELS = new Set(['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW']);
const SHORT_V = new Set(['AA','AE','AH','EH','IH','UH']);
const ONSET = { P:'ㅍ', B:'ㅂ', T:'ㅌ', D:'ㄷ', K:'ㅋ', G:'ㄱ', F:'ㅍ', V:'ㅂ', TH:'ㅅ', DH:'ㄷ', S:'ㅅ', Z:'ㅈ', SH:'ㅅ', ZH:'ㅈ', CH:'ㅊ', JH:'ㅈ', M:'ㅁ', N:'ㄴ', NG:'ㅇ', L:'ㄹ', R:'ㄹ', HH:'ㅎ', TS:'ㅊ', DZ:'ㅈ' };
// 단순 모음: [기본, y계열, w계열]
const VMAP = {
  AA: ['ㅏ','ㅑ','ㅝ'], AE: ['ㅐ','ㅒ','ㅙ'], AH: ['ㅓ','ㅕ','ㅝ'], AO: ['ㅗ','ㅛ','ㅝ'], EH: ['ㅔ','ㅖ','ㅞ'],
  ER: ['ㅓ','ㅕ','ㅝ'], IH: ['ㅣ','ㅣ','ㅟ'], IY: ['ㅣ','ㅣ','ㅟ'], UH: ['ㅜ','ㅠ','ㅜ'], UW: ['ㅜ','ㅠ','ㅜ'], OW: ['ㅗ','ㅛ','ㅝ'],
};
// 이중모음: 첫 모음 + 둘째 음절
const DIPH = { EY: ['EH', 'ㅣ'], AY: ['AA', 'ㅣ'], AW: ['AA', 'ㅜ'], OY: ['AO', 'ㅣ'] };

function vowelJamo(v, glide) {
  const row = VMAP[v];
  if (!row) return 'ㅓ';
  if (glide === 'Y') return row[1];
  if (glide === 'W') return row[2];
  if (glide === 'SH') return row[1] === 'ㅣ' ? 'ㅣ' : row[1]; // 샤, 셔, 쇼, 슈, 시
  return row[0];
}

export function phonesToHangul(input, spelling = '') {
  // 1) 음소 파싱
  let P = input.map(p => {
    const m = /^([A-Z]+)([012])?$/.exec(p);
    const ph = m ? m[1] : p;
    return VOWELS.has(ph) ? { v: ph, s: m && m[2] ? +m[2] : 1 } : { c: ph };
  });
  // 2) R 처리: 모음 뒤 (다음이 모음이 아닌) R 은 탈락, 일부 모음은 '어' 추가 (there→데어, here→히어)
  const Q = [];
  for (let i = 0; i < P.length; i++) {
    const x = P[i];
    if (x.c === 'R') {
      const prev = Q[Q.length - 1], next = P[i + 1];
      if (prev && prev.v && !(next && next.v)) {
        if (['EH','IH','IY','UH','UW','EY','AY','OY'].includes(prev.v)) Q.push({ v: 'AH', s: 0, r: true });
        else if (prev.v === 'AW') Q.push({ v: 'ER', s: 0 });
        continue;
      }
    }
    Q.push(x);
  }
  P = Q;
  // T S → TS, D Z → DZ (cats→캐츠, kids→키즈)
  const R2 = [];
  for (let i = 0; i < P.length; i++) {
    const x = P[i], y = P[i + 1];
    if (x.c === 'T' && y && y.c === 'S' && !(P[i + 2] && P[i + 2].v)) { R2.push({ c: 'TS' }); i++; continue; }
    if (x.c === 'D' && y && y.c === 'Z' && !(P[i + 2] && P[i + 2].v)) { R2.push({ c: 'DZ' }); i++; continue; }
    R2.push(x);
  }
  P = R2;

  // 3) 모음 위치 기준으로 자음군 나누기
  const out = []; // {cho,jung,jong,ep,tail}
  const vIdx = [];
  P.forEach((x, i) => { if (x.v) vIdx.push(i); });
  if (!vIdx.length) {
    // 모음이 없으면 자음마다 '으'
    P.forEach(x => out.push(epSyl(x.c, true)));
    return render(out);
  }
  let prevV = null; // 직전 모음 음소
  let pos = 0;
  for (let k = 0; k <= vIdx.length; k++) {
    const vi = k < vIdx.length ? vIdx[k] : P.length;
    const cluster = P.slice(pos, vi).map(x => x.c);
    const isFinal = k === vIdx.length;
    const isInitial = k === 0;
    const last = out[out.length - 1];
    if (isFinal) {
      placeFinalCluster(out, cluster, prevV);
      break;
    }
    const V = P[vi];
    // 이중모음 AW + 모음 → 아 + 워 (power→파워)
    let glide = null, onsetPh = null;
    let cl = cluster.slice();
    if (!cl.length && prevV === 'AW' && last && last.tailW) { cl = ['W']; last.drop = true; }
    const lastC = cl[cl.length - 1];
    if (lastC === 'Y' || lastC === 'W') {
      glide = cl.pop();
      const c = cl[cl.length - 1];
      if (c && glide === 'W' && (c === 'K' || c === 'G' || c === 'HH')) onsetPh = cl.pop();       // queen→퀸
      else if (c && glide === 'Y' && c !== 'NG' && c !== 'R' && c !== 'W') onsetPh = cl.pop();     // music→뮤직
    } else if (lastC && lastC !== 'NG') {
      onsetPh = cl.pop();
    }
    const onset = onsetPh ? (ONSET[onsetPh] || 'ㅇ') : 'ㅇ';
    if (onsetPh === 'SH' && !glide) glide = 'SH';
    // 앞 음절 받침 / 삽입모음 처리
    if (!isInitial) placeMedialCluster(out, cl, prevV, onsetPh);
    else cl.forEach(c => out.push(epSyl(c, false)));
    // L 이 초성이면 앞 음절에 ㄹ 받침 (flow→플로, hello→헬로, Atlanta→애틀랜타)
    if (onsetPh === 'L') {
      const p = out[out.length - 1];
      if (p && !p.jong && !p.drop && (p.ep || !isInitial)) p.jong = 'ㄹ';
    }
    // 모음
    let vv = V.v, second = null;
    if (DIPH[vv]) { second = DIPH[vv][1]; vv = DIPH[vv][0]; }
    let jung = vowelJamo(vv, glide);
    if (second && glide === 'W' && vv === 'AA') jung = 'ㅘ'; // why→와이, wow→와우
    // 어말 -le 의 비강세 모음 (little→리틀, hustle→허슬)
    const tailPh = P.slice(vi + 1).map(x => x.c || x.v);
    if (vv === 'AH' && V.s === 0 && tailPh.length && tailPh[0] === 'L' && tailPh.length <= 2 && !tailPh.slice(1).some(x => VOWELS.has(x)) && /le[sd]?$/.test(spelling)) jung = 'ㅡ';
    out.push({ cho: onset, jung, jong: '', ph: V.v, s: V.s });
    if (second) out.push({ cho: 'ㅇ', jung: second, jong: '', ph: V.v + '2', tailW: V.v === 'AW' });
    prevV = V.v;
    pos = vi + 1;
  }
  // 떨어진 활음 음절 제거 (파우어 → 파워)
  for (let i = out.length - 1; i >= 0; i--) if (out[i].drop) out.splice(i, 1);
  // 철자 기반 보정: 끝의 비강세 AH 를 'a' 로 쓰면 '아' (drama→드라마)
  const lastV = [...out].reverse().find(x => !x.ep);
  if (lastV && lastV.ph === 'AH' && lastV.s === 0 && !lastV.jong && /a$/.test(spelling)) lastV.jung = 'ㅏ';
  // 어말 OW (L·R·D·N 뒤) → 오우 표기 (flow→플로우, window→윈도우)
  if (lastV && lastV.ph === 'OW' && !lastV.jong && lastV === out[out.length - 1] && ['ㄹ','ㄷ','ㄴ'].includes(lastV.cho)) lastV.tail = '우';
  return render(out);
}

function epSyl(c, isFinal) {
  if (c === 'SH') return { cho: 'ㅅ', jung: isFinal ? 'ㅣ' : 'ㅠ', jong: '', ep: true };
  if (c === 'CH' || c === 'JH' || c === 'ZH') return { cho: ONSET[c], jung: 'ㅣ', jong: '', ep: true };
  if (c === 'Y') return { cho: 'ㅇ', jung: 'ㅣ', jong: '', ep: true };
  if (c === 'W') return { cho: 'ㅇ', jung: 'ㅜ', jong: '', ep: true };
  return { cho: ONSET[c] || 'ㅇ', jung: 'ㅡ', jong: '', ep: true };
}

const CODA = { N: 'ㄴ', M: 'ㅁ', NG: 'ㅇ', L: 'ㄹ' };
const STOP_CODA = { K: 'ㄱ', P: 'ㅂ', T: 'ㅅ' };

function placeMedialCluster(out, cl, prevV, onsetPh) {
  if (!cl.length) return;
  const p = out[out.length - 1];
  let rest = cl.slice();
  if (p && !p.jong) {
    const c = rest[0];
    const next = rest[1] || onsetPh;
    if (CODA[c]) { p.jong = CODA[c]; rest.shift(); }
    else if ((c === 'K' || c === 'P') && SHORT_V.has(prevV) && !p.ep) { p.jong = STOP_CODA[c]; rest.shift(); }
    else if (c === 'T' && SHORT_V.has(prevV) && !p.ep && next && ['P','B','K','G','F','S','SH','CH','JH','HH','T','D','TH','V'].includes(next)) { p.jong = 'ㅅ'; rest.shift(); }
    else if (c === 'T' && prevV === 'AW' && !p.ep) { p.jong = 'ㅅ'; rest.shift(); }
  }
  rest.forEach(c => out.push(epSyl(c, false)));
}

function placeFinalCluster(out, cl, prevV) {
  if (!cl.length) return;
  const p = out[out.length - 1];
  let rest = cl.slice();
  if (p && !p.jong) {
    const c = rest[0];
    if (CODA[c]) { p.jong = CODA[c]; rest.shift(); }
    else if (STOP_CODA[c] && SHORT_V.has(prevV)) { p.jong = STOP_CODA[c]; rest.shift(); }
    else if (c === 'T' && prevV === 'AW') { p.jong = 'ㅅ'; rest.shift(); }
    else if (c === 'B' && SHORT_V.has(prevV)) { p.jong = 'ㅂ'; rest.shift(); }
    else if (c === 'G' && (prevV === 'AE' || prevV === 'IH') && rest.length === 1) { p.jong = 'ㄱ'; rest.shift(); }
  }
  rest.forEach((c, i) => out.push(epSyl(c, i === rest.length - 1)));
  // 어말 L 앞 비강세 모음 → 으 (little→리틀, hustle→허슬)
}

function render(out) {
  return out.map(x => compose(x.cho, x.jung, x.jong) + (x.tail || '') + (x.ep ? "'" : '')).join('');
}

// CMU 음소 → 한글 (빌드 스크립트·런타임 공용)
export function arpabetToHangul(phones, spelling = '') {
  return phonesToHangul(phones, spelling.toLowerCase());
}

// ───────────────── 규칙 기반 영어 G2P (사전에 없는 단어용) ─────────────────
const isV = ch => !!ch && 'aeiou'.includes(ch);
export function englishG2P(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const out = [];
  const n = w.length;
  const vowelCount = (w.match(/[aeiouy]+/g) || []).length;
  let i = 0;
  const at = (k) => w[k] || '';
  const rest = (k) => w.slice(k);
  const push = (...p) => out.push(...p);
  while (i < n) {
    const ch = w[i], r = rest(i);
    // 어말 패턴
    if (r === 'e' && i > 0 && vowelCount > 1) { i++; continue; } // 묵음 e
    if (r === 'es' && i > 1 && /(s|z|x|sh|ch|ge|ce)$/.test(w.slice(0, i + 1)) ) { push('IH0','Z'); i += 2; continue; }
    if (r === 'ed' && i > 1 && vowelCount > 1) {
      const p = w[i - 1];
      if (p === 't' || p === 'd') push('IH0','D'); else if ('pkfsxh'.includes(p)) push('T'); else push('D');
      i += 2; continue;
    }
    if (r === 'le' && i > 0 && !isV(w[i - 1])) { push('AH0','L'); i += 2; continue; }
    if (r.startsWith('tion')) { push('SH','AH0','N'); i += 4; continue; }
    if (r.startsWith('sion')) { push('ZH','AH0','N'); i += 4; continue; }
    if (r.startsWith('ture')) { push('CH','ER0'); i += 4; continue; }
    if (r.startsWith('ough')) { push('AO1'); i += 4; continue; }
    if (r.startsWith('eigh')) { push('EY1'); i += 4; continue; }
    if (r.startsWith('igh')) { push('AY1'); i += 3; continue; }
    if (r.startsWith('tch')) { push('CH'); i += 3; continue; }
    if (r.startsWith('dge')) { push('JH'); i += 3; continue; }
    if (r.startsWith('ing') && i > 0) { push('IH0','NG'); i += 3; continue; }
    if (r === "in" && i > 1 && vowelCount > 1) { push('IH0','N'); i += 2; continue; }
    if (r.startsWith('ch')) { push('CH'); i += 2; continue; }
    if (r.startsWith('sh')) { push('SH'); i += 2; continue; }
    if (r.startsWith('th')) { push(i === 0 && /^(the|this|that|they|them|then|there|these|those|than|though|thus)$/.test(w) ? 'DH' : 'TH'); i += 2; continue; }
    if (r.startsWith('ph')) { push('F'); i += 2; continue; }
    if (r.startsWith('gh')) { if (i === 0) push('G'); i += 2; continue; }
    if (r.startsWith('ck')) { push('K'); i += 2; continue; }
    if (r.startsWith('ng')) { push('NG'); i += 2; continue; }
    if (r.startsWith('nk')) { push('NG','K'); i += 2; continue; }
    if (r.startsWith('qu')) { push('K','W'); i += 2; continue; }
    if (r.startsWith('wh')) { push('W'); i += 2; continue; }
    if (r.startsWith('wr') && i === 0) { push('R'); i += 2; continue; }
    if (r.startsWith('rh') && i === 0) { push('R'); i += 2; continue; }
    if (r.startsWith('old')) { push('OW1','L','D'); i += 3; continue; }
    if (ch === 'h' && i + 1 === n && i > 0) { i++; continue; }
    if (r.startsWith('kn') && i === 0) { push('N'); i += 2; continue; }
    if (r.startsWith('mb') && i + 2 === n) { push('M'); i += 2; continue; }
    // 모음 조합
    if (r.startsWith('ee') || r.startsWith('ea')) {
      if (r.startsWith('ear') && i + 3 < n && !isV(at(i + 3))) { push('ER1'); i += 3; continue; }
      push('IY1'); i += 2; continue;
    }
    if (r.startsWith('ai') || r.startsWith('ay')) { push('EY1'); i += 2; continue; }
    if (r.startsWith('ei')) { push('EY1'); i += 2; continue; }
    if (r.startsWith('ey')) { push(i + 2 === n && vowelCount > 1 ? 'IY0' : 'EY1'); i += 2; continue; }
    if (r.startsWith('oa')) { push('OW1'); i += 2; continue; }
    if (r.startsWith('oo')) { push(at(i + 2) === 'k' ? 'UH1' : 'UW1'); i += 2; continue; }
    if (r.startsWith('ou')) { push('AW1'); i += 2; continue; }
    if (r.startsWith('ow')) {
      const finalOw = i + 2 === n || at(i + 2) === 's';
      if (finalOw) {
        const before = w.slice(Math.max(0, i - 2), i);
        push(/(l|r|sh|[^aeiou][n])$/.test(before) && !/^(n|h|w|c|v|b)$/.test(w.slice(0, i)) ? 'OW1' : 'AW1');
      } else push(at(i + 2) === 'n' || at(i + 2) === 'l' ? 'AW1' : 'OW1');
      i += 2; continue;
    }
    if (r.startsWith('oi') || r.startsWith('oy')) { push('OY1'); i += 2; continue; }
    if (r.startsWith('au') || r.startsWith('aw')) { push('AO1'); i += 2; continue; }
    if (r.startsWith('ew')) { push('UW1'); i += 2; continue; }
    if (r.startsWith('ue') || r.startsWith('ui')) { push('UW1'); i += 2; continue; }
    if (r.startsWith('ie')) { push(i + 2 === n ? 'AY1' : 'IY1'); i += 2; continue; }
    // r-통제 모음
    if (isV(ch) && at(i + 1) === 'r' && !isV(at(i + 2))) {
      if (ch === 'a') push('AA1'); else if (ch === 'o') push('AO1'); else push('ER1');
      i += 2; if (ch === 'a' || ch === 'o') { /* R 은 탈락 */ } continue;
    }
    if (isV(ch)) {
      // 매직 e: V + C + e(어말 / s / d)
      const c1 = at(i + 1), e = at(i + 2), after = w.slice(i + 3);
      const magic = c1 && !isV(c1) && c1 !== 'x' && c1 !== 'r' && e === 'e' && (after === '' || after === 's' || after === 'd');
      if (magic) { push({ a: 'EY1', e: 'IY1', i: 'AY1', o: 'OW1', u: 'UW1' }[ch]); i++; continue; }
      if (i + 1 === n) { // 어말 모음
        if (ch === 'o') push('OW1');
        else if (ch === 'e') push(vowelCount === 1 ? 'IY1' : 'IY0');
        else if (ch === 'a') push('AH0');
        else if (ch === 'i') push('IY1');
        else push('UW1');
        i++; continue;
      }
      push({ a: 'AE1', e: 'EH1', i: 'IH1', o: 'AA1', u: 'AH1' }[ch]); i++; continue;
    }
    if (ch === at(i + 1) && ch !== 'y') { i++; continue; } // 겹자음
    if (ch === 'y') {
      if (i === 0 && isV(at(1))) { push('Y'); i++; continue; }
      if (i > 0 && at(i + 1) && !isV(at(i + 1)) && at(i + 2) === 'e' && i + 3 === n) { push('AY1'); i++; continue; }
      if (i + 1 === n) push(vowelCount > 1 ? 'IY0' : 'AY1'); else push(isV(at(i + 1)) ? 'Y' : 'IH1');
      i++; continue;
    }
    if (ch === 'w') { if (isV(at(i + 1)) || at(i + 1) === 'y') push('W'); i++; continue; }
    if (ch === 'r' && i > 0 && isV(w[i - 1]) && !isV(at(i + 1))) { i++; continue; }
    if (ch === 'c') { push('eiy'.includes(at(i + 1)) && at(i + 1) ? 'S' : 'K'); i++; continue; }
    if (ch === 'g') { push((at(i + 1) === 'e' && (i + 2 === n || at(i + 2) === 'n' || at(i + 2) === 'm')) || (at(i + 1) === 'y') ? 'JH' : 'G'); i++; continue; }
    if (ch === 'x') { push(i === 0 ? 'Z' : 'K', ...(i === 0 ? [] : ['S'])); i++; continue; }
    if (ch === 's') {
      if (i > 0 && isV(w[i - 1]) && isV(at(i + 1))) push('Z');
      else if (i + 1 === n && i > 0 && /[bdglmnrvw]/.test(w[i - 1])) push('Z');
      else push('S');
      i++; continue;
    }
    const map = { b:'B', d:'D', f:'F', h:'HH', j:'JH', k:'K', l:'L', m:'M', n:'N', p:'P', q:'K', r:'R', t:'T', v:'V', z:'Z' };
    if (map[ch]) push(map[ch]);
    i++;
  }
  return out;
}

// ───────────────────────── 영어 사전 ─────────────────────────
let EN_DICT = new Map();
let EN_TAILS = new Map();
export function setEnglishDictionary(obj) {
  EN_DICT = obj instanceof Map ? obj : new Map(Object.entries(obj));
}
export function getEnglishDictionary() { return EN_DICT; }
// data/en-words.json 을 받아 사전으로 등록
export function loadEnglishData(json) {
  const m = new Map();
  for (const line of json.dict.split('\n')) {
    const t = line.indexOf('\t');
    if (t > 0) m.set(line.slice(0, t), line.slice(t + 1));
  }
  setEnglishDictionary(m);
  // 영어 운 꼬리: { "IY.L": "real feel deal", ... } → 단어 → 꼬리
  EN_TAILS = new Map();
  for (const tail in json.tails || {}) for (const w of json.tails[tail].split(' ')) EN_TAILS.set(w, tail);
  return m.size;
}
// 영어 단어의 운 꼬리(마지막 강세 모음부터의 음소). 사전에 없으면 undefined
export function englishRhymeTail(word) { return EN_TAILS.get(word); }

// 영어 단어 → 한글 표기(삽입모음 ' 표시) + 출처
export function englishToHangul(raw, overrides) {
  let w = raw.toLowerCase().replace(/[’‘`]/g, "'").replace(/\$/g, 's');
  if (overrides && overrides.has(w)) return { orth: markEp(overrides.get(w)), src: 'user' };
  // 대문자 약어 (모음 없음): BTS, MC, DJ, YG
  if (raw.length >= 2 && raw.length <= 5 && raw === raw.toUpperCase() && !/[AEIOU]/.test(raw)) return { orth: spellLetters(w), src: 'letters' };
  if (EN_DICT.has(w)) return { orth: EN_DICT.get(w), src: 'dict', key: w };
  const bare = w.replace(/^'+|'+$/g, '');
  if (EN_DICT.has(bare)) return { orth: EN_DICT.get(bare), src: 'dict', key: bare };
  // 축약형·접미사
  if (bare.includes("'")) {
    const noAp = bare.replace(/'/g, '');
    if (EN_DICT.has(noAp)) return { orth: EN_DICT.get(noAp), src: 'dict', key: noAp };
    let m;
    if ((m = /^(.+)in'$/.exec(bare)) && EN_DICT.has(m[1] + 'ing')) return { orth: ingToIn(EN_DICT.get(m[1] + 'ing')), src: 'dict' };
    const suf = { "'s": "스'", "'ll": '을', "'re": '어', "'ve": "브'", "'d": "드'", "n't": "은트'", "'m": '음' };
    for (const [k, v] of Object.entries(suf)) {
      if (bare.endsWith(k)) {
        const stem = bare.slice(0, -k.length);
        const s = englishToHangul(stem, overrides);
        return { orth: joinSuffix(s.orth, v), src: s.src + '+' };
      }
    }
    return englishToHangul(noAp, overrides);
  }
  // 접미사 분해 (사전 어간 + 접미사)
  const tries = [
    [/^(.+)in$/, 'ing', null], [/^(.+?)(?:s|z)$/, '', 'S'], [/^(.+)es$/, '', 'IZ'], [/^(.+)ed$/, '', 'D'], [/^(.+)ing$/, '', 'ING'],
    [/^(.+)er$/, '', 'ER'], [/^(.+)ers$/, '', 'ERS'], [/^(.+)y$/, '', 'Y'], [/^(.+)ly$/, '', 'LY'], [/^(.+)ness$/, '', 'NESS'],
  ];
  for (const [re, alt, kind] of tries) {
    const m = re.exec(bare);
    if (!m || m[1].length < 2) continue;
    if (alt) {
      if (EN_DICT.has(m[1] + alt)) return { orth: ingToIn(EN_DICT.get(m[1] + alt)), src: 'dict+' };
      const st = [m[1], m[1] + 'e', /(.)\1$/.test(m[1]) ? m[1].slice(0, -1) : null].find(x => x && EN_DICT.has(x));
      if (st) return { orth: joinSuffix(EN_DICT.get(st), '인'), src: 'dict+' };
      continue;
    }
    const stems = [m[1], m[1] + 'e'];
    if (/(.)\1$/.test(m[1])) stems.push(m[1].slice(0, -1));
    for (const st of stems) {
      if (!EN_DICT.has(st)) continue;
      const base = EN_DICT.get(st);
      const add = { S: /([ptkf]|th)$/.test(st) ? "스'" : "즈'", IZ: '이즈', D: /[td]$/.test(st) ? '이드' : /[pkfsx]$/.test(st) || /(sh|ch)$/.test(st) ? "트'" : "드'", ING: '잉', ER: '어', ERS: "어즈'", Y: '이', LY: '리', NESS: "니스'" }[kind];
      return { orth: joinSuffix(base, add), src: 'dict+' };
    }
  }
  // 대문자 약어 / 모음 없는 단어 → 알파벳 이름
  if (raw.length <= 5 && raw === raw.toUpperCase() && /[A-Z]{2,}/.test(raw)) return { orth: spellLetters(bare), src: 'letters' };
  if (bare.length === 1) return { orth: LETTER_NAMES[bare] || '', src: 'letters' };
  return { orth: arpabetToHangul(englishG2P(bare), bare), src: 'rule' };
}

export function spellLetters(s) {
  return s.toLowerCase().split('').map(c => LETTER_NAMES[c] || '').join('');
}

// 삽입모음 표시가 없는 사용자 입력: 'ㅡ' 음절을 삽입모음으로 간주
export function markEp(s) {
  if (s.includes("'")) return s;
  return s.split('').map((ch, i) => {
    const d = decompose(ch);
    return d && d.jung === 'ㅡ' && s.length > 1 ? ch + "'" : ch;
  }).join('');
}

// '-ing' → '-in' (flexing→플렉싱→플렉신)
function ingToIn(s) {
  const m = /(.)('?)$/.exec(s);
  const d = m && decompose(m[1]);
  if (d && d.jung === 'ㅣ' && d.jong === 'ㅇ') return s.slice(0, s.length - m[0].length) + compose(d.cho, 'ㅣ', 'ㄴ');
  return s;
}

// 접미사 붙이기: 어간 끝이 삽입모음이고 접미사가 모음으로 시작하면 합친다 (flex+ing → 플렉싱)
function joinSuffix(base, suf) {
  const sd = decompose(suf[0]);
  if (sd && sd.cho === 'ㅇ' && /'$/.test(base)) {
    const lastCh = base.slice(-2, -1);
    const bd = decompose(lastCh);
    if (bd && !bd.jong) return base.slice(0, -2) + compose(bd.cho, sd.jung, sd.jong) + suf.slice(1);
  }
  return base + suf;
}
