// 라임 스캐너 — 라임 판정
// 발음 음절 배열(analyzePronunciation 결과)에서 라임 그룹, 끝라임 구조, 점수를 구한다.
//
//   buildContext       음절마다 판정용 정보(단어·줄 경계, 조사 여부)를 붙이고 비교 함수를 만든다   rhyme/units.js
//   collectCandidates  가까운 줄끼리 구간을 견주어 후보 쌍과 우선순위를 만든다                     rhyme/candidates.js
//   formGroups         후보를 그룹으로 묶고, 같은 말 반복을 표시하고, 우연한 일치를 걸러낸다        rhyme/groups.js
//   buildResult        화면·내보내기용 결과로 정리한다                                             rhyme/result.js
//   computeScheme      끝라임 구조 (AABB …)                                                        rhyme/scheme.js
//   computeScores      100점 점수와 근거                                                           rhyme/score.js
import { buildContext } from './rhyme/units.js';
import { collectCandidates } from './rhyme/candidates.js';
import { formGroups } from './rhyme/groups.js';
import { buildResult } from './rhyme/result.js';
import { computeScheme } from './rhyme/scheme.js';
import { computeScores } from './rhyme/score.js';

export { vowelSim, codaSim } from './rhyme/similarity.js';
export { setLexicon, lexiconFromKo } from './rhyme/endings.js';

// vowelOnly: 모음만 같아도 라임 인정 / minLen: 최소 라임 음절 수 / sensitivity: 0(엄격)~100(느슨) / maxLen: 한 라임의 최대 음절 수
export const DEFAULT_OPTIONS = { vowelOnly: true, minLen: 1, sensitivity: 50, maxLen: 8 };

// 민감도 → 판정 기준값
function thresholds(opt) {
  const t = Math.max(0, Math.min(100, opt.sensitivity)) / 100;
  return {
    T: 0.92 - 0.3 * t,                  // 유사도 하한 (민감도 50 → 0.77)
    minV: t < 0.25 ? 0.9 : 0.6,          // 음절별 모음 유사도 하한
    // 근거 음절 수 n 인 라임을 몇 줄 떨어진 곳까지 찾는가
    W: n => (n === 1 ? (t >= 0.7 ? 1 : 0) : n === 2 ? Math.round(2 + 2 * t) : n === 3 ? Math.round(4 + 4 * t) : Math.round(8 + 8 * t)),
    W1end: 3,                            // 1음절 끝라임 거리 (AABB·ABAB·ABBA)
  };
}

/**
 * @param pron analyzePronunciation() 결과
 * @param options {vowelOnly, minLen, sensitivity, maxLen, exclude}  exclude = 사용자가 '라임 아님'으로 뺀 구간 키 목록
 * @returns {{options, excludedKeys, groups, sylGroup, sylMember, sylRepeat, sylColor, sylExt, content, scheme, scores}}
 */
export function analyzeRhymes(pron, options = {}) {
  const opt = { ...DEFAULT_OPTIONS, ...options };
  const ctx = buildContext(pron, opt, thresholds(opt));
  const { cands, excludedKeys } = collectCandidates(ctx);
  const groups = formGroups(ctx, cands);

  const { exclude: _unused, ...plainOptions } = opt;
  const result = { options: plainOptions, excludedKeys, ...buildResult(ctx, groups), content: ctx.content };
  const { U, ending, pairV, pairC } = ctx;
  result.scheme = computeScheme(pron, result, { ending, pairV: (i, j) => pairV(U[i], U[j]), pairC: (i, j) => pairC(U[i], U[j]) });
  result.scores = computeScores(pron, result);
  return result;
}

// 그룹을 한 줄씩 글로 풀어 쓴다 (콘솔 디버그·테스트 출력용)
export function describeGroups(pron, r) {
  const TAG = { end: '끝라임', multi: '다음절', internal: '내부', vowel: '모음라임', cross: '한영' };
  return r.groups.map(g => `#${g.id + 1} [${g.pattern}] ${g.len}음절 (${g.tags.map(t => TAG[t]).join('·')}): ` +
    g.members.map(m => `${m.text}${m.repeat ? '(반복)' : ''}`).join(' / '));
}
