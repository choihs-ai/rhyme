// 라임 스캐너 — 공유 링크
// 가사와 분석 옵션을 압축해 주소의 # 뒤에 담는다. # 뒤는 서버로 보내지지 않으므로
// 링크를 받은 사람의 브라우저 안에서만 풀린다.
//   z… = deflate-raw 압축 + base64url,  u… = 압축 없이 base64url (압축을 못 쓰는 브라우저)
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64u(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64u(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export const SHARE_KEY = 's';

export async function encodeShare({ text, options }) {
  const payload = { v: 1, t: text };
  if (options) payload.o = { vo: options.vowelOnly ? 1 : 0, ml: options.minLen, se: options.sensitivity };
  const raw = enc.encode(JSON.stringify(payload));
  if (typeof CompressionStream === 'function') {
    try { return 'z' + toB64u(await pipe(raw, new CompressionStream('deflate-raw'))); } catch (e) { /* 아래로 */ }
  }
  return 'u' + toB64u(raw);
}

export async function decodeShare(code) {
  const kind = code[0];
  let bytes = fromB64u(code.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') throw new Error('이 브라우저는 공유 링크 압축을 풀 수 없습니다');
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind !== 'u') throw new Error('알 수 없는 공유 링크 형식');
  const p = JSON.parse(dec.decode(bytes));
  if (!p || typeof p.t !== 'string') throw new Error('공유 링크에 가사가 없습니다');
  const out = { text: p.t.slice(0, 20000) };
  if (p.o) {
    out.options = {};
    if (p.o.vo !== undefined) out.options.vowelOnly = !!p.o.vo;
    if ([1, 2, 3, 4].includes(p.o.ml)) out.options.minLen = p.o.ml;
    if (Number.isFinite(p.o.se)) out.options.sensitivity = Math.max(0, Math.min(100, p.o.se));
  }
  return out;
}

// 주소의 #s=… 를 읽는다 (없으면 null)
export function shareCodeFromHash(hash = location.hash) {
  const m = /^#(?:.*&)?s=([A-Za-z0-9_-]+)/.exec(hash || '');
  return m ? m[1] : null;
}

// 분석기 첫 화면 주소 (index.html 은 빼서 짧게)
export function appBaseUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}
