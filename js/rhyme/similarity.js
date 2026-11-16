// 소리의 닮은 정도
//   모음: 같음 1.0 / 같은 소리 그룹 0.9 / 반모음만 다름 0.9 / 비슷한 소리 0.6 / 그 외 0
//   받침: 같음 1.0 / 같은 계열(비음·폐쇄음) 0.6 / 한쪽만 있음 0.3 / 그 외 0
import { JUNG } from '../pron/hangul.js';

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
export const VOWEL_SIM = JUNG.map(a => JUNG.map(b => vowelSim(a, b)));
export const VOWEL_INDEX = Object.fromEntries(JUNG.map((v, i) => [v, i]));

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
export const canonVowel = v => CANON[v] || v;

export const W_VOWEL = 0.75, W_CODA = 0.25;

// 영어 단어끼리는 영어 발음이 기준이다. 운 꼬리의 마지막 모음이 다르면(milk IH / office AH) 한글 표기가 닮아도 약하게 본다.
// 한글로 옮기면 합쳐지고 영어로도 가까운 모음만 같은 부류로 묶는다.
const EN_VOWEL_CLASS = { AA: 'a', AO: 'a', AH: 'ə', ER: 'ə', IH: 'i', IY: 'i', UH: 'u', UW: 'u', AE: 'AE', EH: 'EH', AY: 'AY', AW: 'AW', EY: 'EY', OY: 'OY', OW: 'OW' };
// 강세 없는 끝 음절(jacket 의 -ket)은 끝소리까지 같아야 라임으로 들린다. 유성/무성, 비음 차이는 같은 소리로 접는다.
const EN_CODA_CLASS = { M: 'N', N: 'N', NG: 'N', D: 'T', G: 'K', B: 'P', Z: 'S', V: 'F', ZH: 'SH', JH: 'CH', DH: 'TH' };
// 운 꼬리 → { cls: 마지막 모음 부류, fin: 마지막 모음부터의 끝소리, stressed: 그 모음이 강세 모음인가 }
export function tailInfo(tail) {
  if (!tail) return null;
  const ph = tail.split('.');
  for (let i = ph.length - 1; i >= 0; i--) {
    const cls = EN_VOWEL_CLASS[ph[i]];
    if (cls) return { cls, fin: cls + '.' + ph.slice(i + 1).map(p => EN_CODA_CLASS[p] || p).join('.'), stressed: i === 0 };
  }
  return null;
}
