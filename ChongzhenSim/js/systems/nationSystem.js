export function getStatBarClass(value, invert) {
  const effective = invert ? 100 - value : value;
  if (effective >= 60) return "nation-stat-bar-inner--good";
  if (effective >= 30) return "nation-stat-bar-inner--warning";
  return "nation-stat-bar-inner--danger";
}

export function formatTreasury(num) {
  if (num >= 10000) return (num / 10000).toFixed(1).replace(/\.0$/, "") + "万两";
  return num + "两";
}

export function formatGrain(num) {
  if (num >= 10000) return (num / 10000).toFixed(1).replace(/\.0$/, "") + "万石";
  return num + "石";
}
