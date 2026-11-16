// 화면 공통 도구: 요소 찾기, 기기 저장소, 토스트, 아래에서 올라오는 시트, 복사·공유
export const $ = s => document.querySelector(s);

// 기기 저장소(localStorage). 저장할 수 없는 환경(사파리 개인정보 보호 모드 등)에서도 앱은 그대로 돈다.
export const storage = {
  get(k, d) { try { const v = localStorage.getItem('rhyme.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rhyme.' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가 */ } },
};

let lastFocus = null;
export function openSheet(title, html, onMount) {
  const sheet = $('#sheet');
  lastFocus = document.activeElement;
  $('#sheet-title').textContent = title;
  const body = $('#sheet-body');
  const fresh = body.cloneNode(false); // 이전 리스너 제거
  body.replaceWith(fresh);
  fresh.innerHTML = html;
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  if (onMount) onMount(fresh);
  sheet.querySelector('.sheet-head .icon-btn').focus({ preventScroll: true });
}
export function closeSheet() {
  $('#sheet').hidden = true;
  document.body.style.overflow = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
let toastT = 0;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* 무시 */ }
    ta.remove();
    return ok;
  }
}
export async function shareOrDownload(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
export const stamp = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`; };
