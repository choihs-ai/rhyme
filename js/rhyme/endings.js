// 조사·어미 표시
// 문법 때문에 저절로 같아지는 소리(가는/하는, 했다/갔다)를 라임 근거에서 빼기 위해, 각 음절이 조사·어미인지 표시한다.
import { decompose } from '../pron/hangul.js';

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
export function markEndings(pron) {
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
export const isLexical = w => LEXICON.has(w.text) || LEXICON.has(w.orth);
export const inLexicon = s => LEXICON.has(s);
