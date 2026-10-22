"use client";

/**
 * 클립보드에 복사한다. 전시장 와이파이에서 http://192.168.. 처럼 보안 주소가 아니면
 * navigator.clipboard 가 없어서, 숨긴 입력칸을 골라 복사하는 옛 방식으로 한 번 더 시도한다
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(t);
      t.select();
      t.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
