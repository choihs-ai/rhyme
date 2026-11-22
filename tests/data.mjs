// 테스트용 사전 등록: 앱과 같은 순서(core → 나머지)로 data/ 의 사전을 읽어 등록한다.
import fs from 'fs';
import { applyCore, applyRest } from '../js/data.js';

const read = f => JSON.parse(fs.readFileSync(new URL('../data/' + f, import.meta.url)));

export function loadData({ core = true, rest = true } = {}) {
  if (core) applyCore(read('core.json'));
  if (rest) applyRest(read('en-words.json'), read('ko-words.json'), read('names.json'));
}
