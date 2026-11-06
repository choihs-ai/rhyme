// 1단계 검증: 발음 변환기
//   node tests/pronounce.test.mjs          (테스트 가사 단계별 출력 + 규칙 테스트)
import fs from 'fs';
import { loadEnglishData, analyzePronunciation } from '../js/pronounce.js';

loadEnglishData(JSON.parse(fs.readFileSync(new URL('../data/en-words.json', import.meta.url))));

export const TEST_LYRICS = `너의 money 내 머니 다 같은 소리
밤새 달려 갈망한 날 봐 이제 팔자
flow 위로 올라 so 높이 날아
문제없어 끝없어 계속 걸어`;

let fail = 0;
const eq = (name, got, want) => {
  if (got === want) return;
  fail++;
  console.log(`  ✗ ${name}: got ${got}, want ${want}`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('━━ 테스트 가사 발음 변환 (단계별) ━━');
  analyzePronunciation(TEST_LYRICS, { debug: true });
}

// 표준 발음 규칙
const PHON = {
  '옷이':'오시','국물':'궁물','신라':'실라','좋아':'조아','좋고':'조코','놓는':'논는','축하':'추카','같이':'가치','굳이':'구지','읽어':'일거',
  '앉아':'안자','없는':'엄는','밟다':'밥따','맑게':'말께','닫히다':'다치다','많다':'만타','싫어':'시러','값이':'갑씨','희망':'히망','계시다':'게시다',
  '가져':'가저','칼날':'칼랄','종로':'종노','백로':'뱅노','국밥':'국빱','앉고':'안꼬','넓게':'널께','뚫는':'뚤른','입학':'이팍','맛없다':'마덥따',
  '읽는':'잉는','밥물':'밤물','협력':'혐녁','의사':'의사','회의':'회이','꽃을':'꼬츨','부엌에':'부어케','닭이':'달기','흙':'흑','삶':'삼',
  '너의':'너이','끝없어':'끄덥써','문제없어':'문제업써','걸어':'거러','높이':'노피','날아':'나라',
};
for (const [w, want] of Object.entries(PHON)) eq(w, analyzePronunciation(w).words[0].pron, want);

// 숫자·기호·영어
const ORTH = {
  '24':'이십사', '24살':'스물네살', '3시':'세시', '1999':'천구백구십구', '3.14':'삼점일사', '10000':'만', '&':'앤', '100%':'백퍼센트',
  'money':'머니', 'flow':'플로우', 'gang':'갱', 'so':'소', 'gonna':'거너', 'wanna':'워너', "'cause":'커즈', 'BTS':'비티에스', 'MC':'엠씨',
  "runnin'":'러닌', 'Ca$h':'캐시', 'flexin':'플렉신', '24/7':'투엔티포세븐', 'swag':'스웩', 'everything':'에브리띵', 'yeah':'예',
};
for (const [w, want] of Object.entries(ORTH)) eq(w, analyzePronunciation(w).words.map(x => x.orth).join(''), want);

// 영어 'flow' = 삽입모음 '플' + '로우' 2음절, 'money' 2음절
const fl = analyzePronunciation('flow').syllables;
eq('flow 음절수', fl.length, 2); eq('flow 삽입모음', fl[0].ep, true); eq('flow 표기', fl[1].ch, '로우');

const total = Object.keys(PHON).length + Object.keys(ORTH).length + 3;
console.log(`\n발음 변환 테스트: ${total - fail}/${total} 통과`);
if (fail) process.exitCode = 1;
