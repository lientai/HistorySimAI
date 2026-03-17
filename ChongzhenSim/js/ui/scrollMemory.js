let savedScrollTop = null;

export function saveEdictScrollTop(val) {
  savedScrollTop = val;
}

export function takeEdictScrollTop() {
  const val = savedScrollTop;
  savedScrollTop = null;
  return val;
}
