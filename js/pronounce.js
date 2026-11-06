// 라임 스캐너 — 발음 변환기
// 모든 가사를 "음절 단위 발음 표기"로 통일한다.
//   1) 토큰 분리 (줄 / 단어 / 한글·영어·숫자·기호 조각)
//   2) 표기 변환 (영어 → 한글 음차, 숫자·기호 → 읽는 소리)
//   3) 한국어 음운 규칙 (연음, 비음화, 유음화, 경음화, 격음화, 구개음화, 7대표음)
//   4) 음절 배열 생성 (모음·받침·원문 위치)

// ───────────────────────── 한글 자모 ─────────────────────────
export const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
export const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
export const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const S_BASE = 0xAC00, S_LAST = 0xD7A3;

export function isHangulSyllable(ch) {
  const c = ch.charCodeAt(0);
  return c >= S_BASE && c <= S_LAST;
}
export function decompose(ch) {
  const c = ch.charCodeAt(0) - S_BASE;
  if (c < 0 || c > 11171) return null;
  return { cho: CHO[Math.floor(c / 588)], jung: JUNG[Math.floor((c % 588) / 28)], jong: JONG[c % 28] };
}
export function compose(cho, jung, jong = '') {
  const a = CHO.indexOf(cho), b = JUNG.indexOf(jung), c = JONG.indexOf(jong);
  if (a < 0 || b < 0 || c < 0) return '?';
  return String.fromCharCode(S_BASE + a * 588 + b * 28 + c);
}

// 겹받침 분해
const COMPOUND = { 'ㄳ':['ㄱ','ㅅ'], 'ㄵ':['ㄴ','ㅈ'], 'ㄶ':['ㄴ','ㅎ'], 'ㄺ':['ㄹ','ㄱ'], 'ㄻ':['ㄹ','ㅁ'], 'ㄼ':['ㄹ','ㅂ'],
  'ㄽ':['ㄹ','ㅅ'], 'ㄾ':['ㄹ','ㅌ'], 'ㄿ':['ㄹ','ㅍ'], 'ㅀ':['ㄹ','ㅎ'], 'ㅄ':['ㅂ','ㅅ'] };
// 받침 7대표음
const REP = { '':'', 'ㄱ':'ㄱ','ㄲ':'ㄱ','ㅋ':'ㄱ','ㄳ':'ㄱ','ㄺ':'ㄱ',
  'ㄴ':'ㄴ','ㄵ':'ㄴ','ㄶ':'ㄴ',
  'ㄷ':'ㄷ','ㅅ':'ㄷ','ㅆ':'ㄷ','ㅈ':'ㄷ','ㅊ':'ㄷ','ㅌ':'ㄷ','ㅎ':'ㄷ',
  'ㄹ':'ㄹ','ㄼ':'ㄹ','ㄽ':'ㄹ','ㄾ':'ㄹ','ㅀ':'ㄹ',
  'ㅁ':'ㅁ','ㄻ':'ㅁ', 'ㅂ':'ㅂ','ㅍ':'ㅂ','ㅄ':'ㅂ','ㄿ':'ㅂ', 'ㅇ':'ㅇ' };
const TENSE = { 'ㄱ':'ㄲ','ㄷ':'ㄸ','ㅂ':'ㅃ','ㅅ':'ㅆ','ㅈ':'ㅉ' };
const ASPIRATE = { 'ㄱ':'ㅋ','ㄷ':'ㅌ','ㅂ':'ㅍ','ㅈ':'ㅊ' };
const NASAL = { 'ㄱ':'ㅇ','ㄷ':'ㄴ','ㅂ':'ㅁ' };
// ㅈ·ㅉ·ㅊ 뒤 반모음 탈락 (져→저)
const DEGLIDE = { 'ㅑ':'ㅏ','ㅕ':'ㅓ','ㅛ':'ㅗ','ㅠ':'ㅜ','ㅒ':'ㅐ','ㅖ':'ㅔ' };
// 받침 뒤 모음으로 시작하는 실질형태소: 대표음으로 바꾼 뒤 연음 (끝없어→끄덥써, 맛없다→마덥따)
const REAL_MORPHEME_V = new Set(['없','옷','웃','어치']);

// ───────────────────────── 한국어 음운 규칙 ─────────────────────────
function neutralize(jong) { return REP[jong] ?? jong; }

// 한 단어(어절) 안의 음절 배열에 표준 발음 규칙을 적용한다. S: [{cho,jung,jong}] (제자리 수정)
export function applyPhonology(S) {
  const n = S.length;
  for (let i = 0; i < n; i++) {
    const a = S[i], b = S[i + 1];
    if (!b) { a.jong = finalCoda(a.jong); continue; }
    boundary(a, b, S[i + 2]);
  }
  // 모음 규칙
  for (let i = 0; i < n; i++) {
    const s = S[i];
    if (s.jung === 'ㅢ') {
      // 자음 뒤 'ㅢ'는 [ㅣ] (희망→히망), 첫음절 아닌 '의'는 [이] (너의→너이, 회의→회이)
      if (s.cho !== 'ㅇ' || i > 0) s.jung = 'ㅣ';
    }
    if ((s.cho === 'ㅈ' || s.cho === 'ㅉ' || s.cho === 'ㅊ') && DEGLIDE[s.jung]) s.jung = DEGLIDE[s.jung];
    // 영어 sh 표기(쇼·샤·셔·슈)의 반모음은 표기상 관습 → 모음 핵만 남김 (show=ㅗ, go 와 라임)
    else if ((s.cho === 'ㅅ' || s.cho === 'ㅆ') && s.en && DEGLIDE[s.jung]) { s.disp = s.disp || compose(s.cho, s.jung, s.jong); s.jung = DEGLIDE[s.jung]; }
    if (s.jung === 'ㅖ' && s.cho !== 'ㅇ' && s.cho !== 'ㄹ') s.jung = 'ㅔ'; // 계→게
  }
  return S;
}

function finalCoda(j) { return neutralize(j); }

function boundary(a, b, c) {
  let C = a.jong;
  let O = b.cho;
  if (!C) return;
  // 1) ㅎ 받침 (좋아→조아, 좋고→조코, 놓는→논는, 좋소→조쏘, 않아→아나, 싫어→시러)
  if (C === 'ㅎ' || C === 'ㄶ' || C === 'ㅀ') {
    const rest = C === 'ㅎ' ? '' : (C === 'ㄶ' ? 'ㄴ' : 'ㄹ');
    if (O === 'ㅇ') {
      a.jong = '';
      if (rest) b.cho = rest;
      return;
    }
    if (ASPIRATE[O]) { b.cho = ASPIRATE[O]; a.jong = rest; return; }
    if (O === 'ㅅ') { b.cho = 'ㅆ'; a.jong = rest; return; }
    if (O === 'ㄴ') {
      a.jong = rest || 'ㄴ';
      if (a.jong === 'ㄹ') b.cho = 'ㄹ'; // 뚫는→뚤른
      return;
    }
    a.jong = rest || 'ㄷ';
    C = a.jong;
  }
  // 2) 연음 (옷이→오시, 읽어→일거, 없어→업써, 같이→가치)
  if (O === 'ㅇ') {
    if (C === 'ㅇ') return;
    const syl = compose('ㅇ', b.jung, b.jong);
    const two = c ? syl + compose(c.cho, c.jung, c.jong) : '';
    if (REAL_MORPHEME_V.has(syl) || REAL_MORPHEME_V.has(two)) {
      // 받침 뒤 실질형태소: 대표음으로 바꾼 뒤 연음 (끝없어→끄덥써, 값어치→가버치)
      a.jong = '';
      b.cho = neutralize(C);
      return;
    }
    const pair = COMPOUND[C];
    if (pair) {
      a.jong = pair[0];
      let mv = pair[1];
      if (mv === 'ㅌ' && b.jung === 'ㅣ') mv = 'ㅊ';
      if (mv === 'ㅅ') mv = 'ㅆ'; // 값이→갑씨, 없어→업써
      b.cho = mv;
      return;
    }
    a.jong = '';
    let mv = C;
    if (b.jung === 'ㅣ') { if (mv === 'ㄷ') mv = 'ㅈ'; else if (mv === 'ㅌ') mv = 'ㅊ'; } // 구개음화
    b.cho = mv;
    return;
  }
  // 3) 격음화: 받침 + ㅎ (축하→추카, 입학→이팍, 밝히다→발키다)
  if (O === 'ㅎ') {
    let keep = '', base = C;
    if (COMPOUND[C]) { keep = COMPOUND[C][0]; base = COMPOUND[C][1]; }
    let asp = null;
    if (base === 'ㅈ' || base === 'ㅊ') asp = 'ㅊ';
    else {
      const r = neutralize(base);
      if (ASPIRATE[r]) asp = ASPIRATE[r];
    }
    if (asp) {
      a.jong = keep;
      b.cho = asp;
      if (asp === 'ㅌ' && b.jung === 'ㅣ') b.cho = 'ㅊ'; // 굳히다→구치다
      return;
    }
  }
  // 4) 받침 정규화 (겹받침 단순화 + 7대표음)
  let N;
  if (C === 'ㄺ' && O === 'ㄱ') N = 'ㄹ';           // 맑게→말께
  else if (C === 'ㄼ' && a.cho === 'ㅂ' && a.jung === 'ㅏ') N = 'ㅂ'; // 밟다→밥따
  else N = neutralize(C);
  a.jong = N;
  // 5) 경음화 (국밥→국빱, 앉고→안꼬, 넓게→널께)
  if (TENSE[O]) {
    if (N === 'ㄱ' || N === 'ㄷ' || N === 'ㅂ') b.cho = TENSE[O];
    else if ((C === 'ㄵ' || C === 'ㄻ' || C === 'ㄼ' || C === 'ㄾ' || C === 'ㄺ') && O !== 'ㅂ') b.cho = TENSE[O];
  }
  O = b.cho;
  // 6) 비음화·유음화
  if (O === 'ㄹ') {
    if (N === 'ㄴ') a.jong = 'ㄹ';                         // 신라→실라
    else if (N === 'ㅁ' || N === 'ㅇ') b.cho = 'ㄴ';       // 종로→종노
    else if (NASAL[N]) { b.cho = 'ㄴ'; a.jong = NASAL[N]; } // 백로→뱅노
  } else if (O === 'ㄴ' || O === 'ㅁ') {
    if (NASAL[N]) a.jong = NASAL[N];                       // 국물→궁물
    else if (N === 'ㄹ' && O === 'ㄴ') b.cho = 'ㄹ';       // 칼날→칼랄
  }
}

// ───────────────────────── 숫자 읽기 ─────────────────────────
const SINO = ['영','일','이','삼','사','오','육','칠','팔','구'];
const NATIVE_UNITS = ['', '하나','둘','셋','넷','다섯','여섯','일곱','여덟','아홉'];
const NATIVE_UNITS_MOD = ['', '한','두','세','네','다섯','여섯','일곱','여덟','아홉'];
const NATIVE_TENS = ['', '열','스물','서른','마흔','쉰','예순','일흔','여든','아흔'];
const NATIVE_COUNTERS = ['시간','살','시','개','명','마리','잔','병','가지','곳','군데','권','사람','줄','켤레','송이','달','바퀴','번째'];
const EN_NUM = ['제로','원','투','쓰리','포','파이브','식스','세븐','에잇','나인','텐','일레븐','트웰브','써틴','포틴','피프틴','식스틴','세븐틴','에이틴','나인틴'];
const EN_TENS = ['', '', '트웬티','써티','포티','피프티','식스티','세븐티','에이티','나인티'];

function sinoGroup(n) { // 0..9999
  const units = ['천','백','십',''];
  const digits = String(n).padStart(4, '0').split('').map(Number);
  let out = '';
  digits.forEach((d, k) => {
    if (!d) return;
    if (d === 1 && units[k]) out += units[k];
    else out += SINO[d] + units[k];
  });
  return out;
}
export function readSino(str) {
  str = str.replace(/^0+(?=\d)/, '');
  if (str.length > 16) return str.split('').map(d => SINO[+d]).join('');
  if (/^0+$/.test(str)) return '영';
  const big = ['', '만', '억', '조'];
  let out = '';
  let s = str;
  const groups = [];
  while (s.length) { groups.unshift(+s.slice(-4)); s = s.slice(0, -4); }
  groups.forEach((g, k) => {
    const unit = big[groups.length - 1 - k];
    if (!g) return;
    if (g === 1 && unit === '만' && !out) out += '만';
    else out += sinoGroup(g) + unit;
  });
  return out;
}
export function readNative(n, modifier) {
  if (n <= 0 || n >= 100) return null;
  const t = Math.floor(n / 10), u = n % 10;
  let tens = NATIVE_TENS[t];
  if (modifier && u === 0 && t === 2) tens = '스무';
  return tens + (modifier ? NATIVE_UNITS_MOD[u] : NATIVE_UNITS[u]);
}
export function readEnglishNumber(str) {
  const n = parseInt(str, 10);
  if (String(n) !== str.replace(/^0+(?=\d)/, '')) return str.split('').map(d => EN_NUM[+d]).join('');
  if (n < 20) return EN_NUM[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? EN_NUM[n % 10] : '');
  if (n < 10000 && str.length === 4) { // 1994 → 나인틴 나인티포
    const hi = Math.floor(n / 100), lo = n % 100;
    if (lo === 0) return readEnglishNumber(String(hi)) + '헌드레드';
    return readEnglishNumber(String(hi)) + (lo < 10 ? '오' + EN_NUM[lo] : readEnglishNumber(String(lo)));
  }
  return str.split('').map(d => EN_NUM[+d]).join('');
}

const SYMBOL_READ = { '&':'앤', '%':'퍼센트', '$':'달러', '@':'앳', '#':'샵', '+':'플러스', '=':'이퀄', '♥':'하트', '❤':'하트', '♡':'하트', '₩':'원', '€':'유로', '×':'곱하기' };
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
  return m.size;
}

// 영어 단어 → 한글 표기(삽입모음 ' 표시) + 출처
export function englishToHangul(raw, overrides) {
  let w = raw.toLowerCase().replace(/[’‘`]/g, "'").replace(/\$/g, 's');
  if (overrides && overrides.has(w)) return { orth: markEp(overrides.get(w)), src: 'user' };
  // 대문자 약어 (모음 없음): BTS, MC, DJ, YG
  if (raw.length >= 2 && raw.length <= 5 && raw === raw.toUpperCase() && !/[AEIOU]/.test(raw)) return { orth: spellLetters(w), src: 'letters' };
  if (EN_DICT.has(w)) return { orth: EN_DICT.get(w), src: 'dict' };
  const bare = w.replace(/^'+|'+$/g, '');
  if (EN_DICT.has(bare)) return { orth: EN_DICT.get(bare), src: 'dict' };
  // 축약형·접미사
  if (bare.includes("'")) {
    const noAp = bare.replace(/'/g, '');
    if (EN_DICT.has(noAp)) return { orth: EN_DICT.get(noAp), src: 'dict' };
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
    return d && d.jung === 'ㅡ' && i > 0 ? ch + "'" : ch;
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

// ───────────────────────── 토큰화 ─────────────────────────
const RE_HANGUL = /[가-힣]/;
const RE_LATIN = /[A-Za-z]/;
const RE_DIGIT = /[0-9]/;
const HEADER_RE = /^\s*[\[(（【]?\s*(verse|chorus|hook|bridge|intro|outro|pre-?chorus|pre-?hook|refrain|interlude|훅|벌스|코러스|후렴|인트로|아웃트로|브릿지|브리지|간주)[^\])）】]*[\])）】]?\s*:?\s*$/i;

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

// 숫자 조각 읽기 (문맥: 뒤 한글, 앞뒤 영어)
function readNumberPart(part, prev, next) {
  const t = part.text.replace(/,/g, '');
  if (t === '24/7') return '투엔티포세븐';
  if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split('/'); return readSino(b) + '분의' + readSino(a); }
  if (/^\d+\.\d+$/.test(t)) {
    const [a, b] = t.split('.');
    return readSino(a) + '점' + b.split('').map(d => SINO[+d]).join('');
  }
  if ((prev && prev.type === 'en') || (next && next.type === 'en')) return readEnglishNumber(t);
  if (next && next.type === 'ko') {
    const n = parseInt(t, 10);
    const counter = NATIVE_COUNTERS.find(c => next.text.startsWith(c));
    if (counter && n > 0 && n < 100) {
      if (counter === '번째' && n === 1) return '첫';
      return readNative(n, true);
    }
  }
  if (t.length > 1 && t.startsWith('0')) return t.split('').map(d => (d === '0' ? '공' : SINO[+d])).join('');
  return readSino(t);
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
        units.push(...parseOrth(r.orth, p.start, p.end, p.text, 'en', true));
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
      ep: !!u.ep, lang: u.lang, src: u.src,
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
