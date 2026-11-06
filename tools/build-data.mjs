// 사전 데이터 생성기 (빌드 도구 — 앱 실행에는 필요 없음)
//
//   node tools/build-data.mjs --cmu cmudict.dict --en-freq wf-en.txt --ko-list ko-list.tsv
//
// 입력
//   cmudict.dict  : CMU Pronouncing Dictionary (BSD) — pip install cmudict 의 data/cmudict.dict
//   wf-en.txt     : 영어 빈도 순 단어 목록(한 줄에 한 단어) — wordfreq.top_n_list('en', 40000)
//   ko-list.tsv   : tools/build-ko-list.py 출력 (단어, 빈도, tier)
//   tools/data-src/en-rap.txt : 직접 작성한 랩 영어 발음 예외 사전
// 출력
//   data/en-words.json, data/ko-words.json
//
// 색인 키 = 단어의 실제 발음 음절에서 초성을 ㅇ으로 바꾼 "운(rime)" 문자열.
//   예) 머니 → "어이", 갈망 → "알앙", 없어[업써] → "업어"
//   모음만 비교할 때는 각 글자의 중성, 받침 비교는 종성을 쓴다.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { arpabetToHangul, setEnglishDictionary, analyzePronunciation, compose, decompose, markEp } from '../js/pronounce.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? acc.concat([[a.slice(2), arr[i + 1]]]) : acc), []));
const EN_DICT_SIZE = +(args['en-size'] || 20000);
const EN_REC_SIZE = +(args['en-rec'] || 5000);

export function rimeKey(syls) {
  return syls.map(s => compose('ㅇ', s.jung, s.jong)).join('');
}

// ───────── 영어 ─────────
function loadCmu(file) {
  const m = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const r = /^(\S+?)(\(\d+\))?\s+(.+?)(\s+#.*)?$/.exec(line);
    if (!r || r[2]) continue;
    m.set(r[1], r[3].split(' '));
  }
  return m;
}

function buildEnglish() {
  const cmu = loadCmu(args.cmu);
  const dict = new Map();
  const rap = [];
  const norec = new Set();
  // 1) 직접 작성한 예외 사전 (우선)
  const curated = fs.readFileSync(path.join(ROOT, 'tools/data-src/en-rap.txt'), 'utf8').split('\n');
  for (const line of curated) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [w, pron, flag] = line.trim().split(/\s+/);
    if (dict.has(w)) continue;
    let p = pron;
    if (!p.includes("'")) {
      // CMU 변환과 글자가 같으면 CMU 의 삽입모음 표시를 쓰고, 아니면 'ㅡ' 음절 = 삽입모음으로 본다
      const ph = cmu.get(w);
      const auto = ph ? arpabetToHangul(ph, w) : '';
      p = auto && auto.replace(/'/g, '') === pron ? auto : markEp(pron);
    }
    dict.set(w, p);
    if (flag === '-') norec.add(w); else rap.push(w);
  }
  // 2) 빈도 상위 단어 (CMU 발음 → 한글)
  const freq = fs.readFileSync(args['en-freq'], 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
  const common = [];
  for (const w of freq) {
    if (dict.size >= EN_DICT_SIZE) break;
    if (!/^[a-z][a-z']*$/.test(w) || (w.length < 2 && w !== 'a' && w !== 'i')) continue;
    const ph = cmu.get(w);
    if (!ph) continue;
    if (!dict.has(w)) dict.set(w, arpabetToHangul(ph, w));
    if (common.length < EN_REC_SIZE && w.length >= 3 && !w.includes("'")) common.push(w);
  }
  setEnglishDictionary(dict);
  // 3) 추천용 색인: 랩 단어 + 흔한 단어
  const STOP = new Set('the and for are but not you all any can had her was one our out has him his how its may new now old see two way who did get let put say she too use that with have this will your from they know want been good much some time very when come here just like long make many more only over such take than them well were what into then there these would could should their about which while where being other after those still might since under again never'.split(' '));
  const pool = [];
  const seen = new Set();
  for (const w of rap.concat(common)) {
    if (seen.has(w) || norec.has(w) || (STOP.has(w) && !rap.includes(w))) continue;
    seen.add(w);
    pool.push(w);
  }
  const idx = {};
  for (const w of pool) {
    const syl = analyzePronunciation(w).syllables;
    if (!syl.length) continue;
    const k = rimeKey(syl);
    (idx[k] = idx[k] || []).push(w);
  }
  const out = {
    v: 1,
    note: 'en-words: 영어 발음 사전 + 랩 단어 추천 색인. dict = "단어\\t한글발음" 줄 목록(\' = 삽입모음). idx 키 = 발음 운(초성→ㅇ).',
    sources: ['CMU Pronouncing Dictionary (BSD)', 'wordfreq English frequency list (CC-BY-SA 4.0)', 'tools/data-src/en-rap.txt (직접 작성)'],
    count: dict.size,
    rapCount: rap.length,
    dict: [...dict].map(([w, p]) => `${w}\t${p}`).join('\n'),
    rap: rap.join(' '),
    idx: Object.fromEntries(Object.entries(idx).map(([k, ws]) => [k, ws.join(' ')])),
  };
  fs.writeFileSync(path.join(ROOT, 'data/en-words.json'), JSON.stringify(out));
  console.log(`en-words.json: dict ${dict.size}, curated ${rap.length + norec.size} (rap ${rap.length}), rec pool ${pool.length}, keys ${Object.keys(idx).length}`);
  return dict;
}

// ───────── 한국어 ─────────
function buildKorean() {
  const rows = fs.readFileSync(args['ko-list'], 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => {
    const [w, f, t] = l.split('\t');
    return { w, f: +f, t: +t };
  });
  const idx = {};
  let n = 0;
  for (const r of rows) {
    if (!/^[가-힣]+$/.test(r.w)) continue;
    const syl = analyzePronunciation(r.w).syllables;
    const k = rimeKey(syl);
    const e = (idx[k] = idx[k] || [[], []]);
    e[r.t === 1 ? 0 : 1].push(r.w);
    n++;
  }
  const out = {
    v: 1,
    note: 'ko-words: 한국어 단어 사전. idx 키 = 실제 발음의 운(초성→ㅇ) 문자열, 값 = "기본어 …|활용형 …" (각각 빈도순).',
    sources: ['FrequencyWords ko_50k (OpenSubtitles 2018, CC-BY-SA 4.0)', 'wordfreq Korean (CC-BY-SA 4.0)', 'Kiwi 형태소 분석으로 분류'],
    count: n,
    idx: Object.fromEntries(Object.entries(idx).map(([k, [a, b]]) => [k, b.length ? a.join(' ') + '|' + b.join(' ') : a.join(' ')])),
  };
  fs.writeFileSync(path.join(ROOT, 'data/ko-words.json'), JSON.stringify(out));
  console.log(`ko-words.json: words ${n}, keys ${Object.keys(idx).length}`);
}

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
if (args.cmu && args['en-freq']) buildEnglish();
if (args['ko-list']) buildKorean();
for (const f of ['en-words.json', 'ko-words.json']) {
  const p = path.join(ROOT, 'data', f);
  if (fs.existsSync(p)) console.log(`${f}: ${(fs.statSync(p).size / 1024).toFixed(0)} KB`);
}
