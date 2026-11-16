// 한글 자모 분해·합성과 표준 발음 규칙
//   applyPhonology: 한 단어(어절)의 음절 배열에 연음·비음화·유음화·경음화·격음화·구개음화·7대표음을 적용한다.

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
