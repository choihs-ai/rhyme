// 사전 등록: 앱과 테스트가 같은 순서로 쓴다.
//   1) data/core.json      가사 분석에 필요한 사전 (먼저 받는다)
//   2) data/en-words.json  영어 발음 사전 나머지 + 추천 색인
//      data/ko-words.json  한국어 추천 색인
//      data/names.json     이름·브랜드 추천 색인 (없어도 된다)
import { loadEnglishData } from './pronounce.js';
import { setLexicon } from './rhyme.js';
import { setDictionaries } from './recommend.js';

export function applyCore(core) {
  loadEnglishData(core.en);
  setLexicon(new Set(core.ko.lex.split(' ')));
}

export function applyRest(en, ko, names) {
  loadEnglishData(en, { merge: true });
  setDictionaries(ko, en, names);
}
