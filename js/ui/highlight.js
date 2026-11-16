// 하이라이트 표시에 공통으로 쓰는 것: 그룹 색, 밑줄 두께, 글자 → 라임 그룹 대응
// 화면(HTML)과 이미지 저장(canvas)이 같은 규칙으로 그리도록 한곳에 둔다.

// 그룹 색: 색각 이상에서도 이웃 색이 구분되도록 검증한 8색 (다크/라이트 각각).
// 9번째 그룹부터는 같은 색을 밑줄 모양(이중선·점선)과 그룹 번호로 구분한다. 색만으로 구분하지 않기 위해서다.
export const PALETTE = {
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
};
export const TAG_LABEL = { end: '끝라임', multi: '다음절', internal: '내부 라임', vowel: '모음 라임', cross: '한·영 교차' };

const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// 그룹 번호 → { c: 선 색, bg: 배경 색, tier: 밑줄 모양(0 실선, 1 이중선, 2 점선) }
export function groupStyle(id, theme) {
  const pal = PALETTE[theme === 'light' ? 'light' : 'dark'];
  const c = pal[id % pal.length];
  const [r, g, b] = hexRgb(c);
  return { c, bg: `rgba(${r},${g},${b},${theme === 'light' ? 0.24 : 0.3})`, tier: Math.floor(id / pal.length) % 3 };
}
// 라임 길이(음절 수) → 밑줄 두께(px)
export const underlineWidth = len => (len <= 1 ? 2 : len === 2 ? 3 : len === 3 ? 4 : len <= 5 ? 5 : 6);

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pct = x => `${(x * 100).toFixed(1)}%`;

// 한 줄의 글자마다 어느 음절·그룹·멤버에 속하는지 구한다 (-1 = 없음).
// 한 멤버 안의 띄어쓰기는 같은 그룹으로 이어 칠한다 (날 봐).
export function mapLineChars(line, text, pron, rhyme) {
  const S = pron.syllables;
  const n = text.length;
  const syl = new Int32Array(n).fill(-1), group = new Int32Array(n).fill(-1), member = new Int32Array(n).fill(-1);
  for (const i of line.syl) for (let k = S[i].src[0]; k < S[i].src[1]; k++) if (k - line.start < n) syl[k - line.start] = i;
  for (let k = 0; k < n; k++) {
    const i = syl[k];
    if (i >= 0 && rhyme.sylColor[i] >= 0) { group[k] = rhyme.sylColor[i]; member[k] = rhyme.sylMember[i]; }
  }
  for (let k = 0; k < n; k++) {
    if (syl[k] >= 0) continue;
    let l = k - 1; while (l >= 0 && syl[l] < 0) l--;
    let r = k + 1; while (r < n && syl[r] < 0) r++;
    if (l >= 0 && r < n && group[l] >= 0 && group[l] === group[r] && member[l] === member[r]) { group[k] = group[l]; member[k] = member[l]; }
  }
  return { syl, group, member };
}
