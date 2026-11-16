// 숫자·기호를 읽는 소리로 바꾼다 (24 → 이십사, 24살 → 스물네살, 2pac → 투팩, & → 앤)

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

export const SYMBOL_READ = { '&':'앤', '%':'퍼센트', '$':'달러', '@':'앳', '#':'샵', '+':'플러스', '=':'이퀄', '♥':'하트', '❤':'하트', '♡':'하트', '₩':'원', '€':'유로', '×':'곱하기' };

// 숫자 조각 읽기 (문맥: 뒤 한글, 앞뒤 영어)
export function readNumberPart(part, prev, next) {
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
