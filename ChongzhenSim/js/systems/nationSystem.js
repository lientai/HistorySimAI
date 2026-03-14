export function getStatBarClass(value, invert) {
  const effective = invert ? 100 - value : value;
  if (effective >= 60) return "nation-stat-bar-inner--good";
  if (effective >= 30) return "nation-stat-bar-inner--warning";
  return "nation-stat-bar-inner--danger";
}

export function formatTreasury(num) {
  return num.toLocaleString() + "两";
}

export function formatGrain(num) {
  return num.toLocaleString() + "石";
}
