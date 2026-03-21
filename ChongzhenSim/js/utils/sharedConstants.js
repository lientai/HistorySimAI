export const AVAILABLE_AVATAR_NAMES = new Set([
  "黄道周", "韩继思", "陈新甲", "袁崇焕", "范景文", "祖大寿", "王永光", "温体仁", "洪承畴", "毕自严",
  "梁廷栋", "林钎", "杨嗣昌", "李邦华", "曹文诏", "曹化淳", "张凤翔", "左良玉", "孙承宗", "孙传庭",
  "周延儒", "周奎", "吴三桂", "史可法", "卢象升", "倪元璐",
]);

export const PERCENT_KEYS = ["militaryStrength", "civilMorale", "borderThreat", "disasterLevel", "corruptionLevel"];

export const NATION_LABELS = {
  treasury: "国库",
  grain: "粮储",
  militaryStrength: "军力",
  civilMorale: "民心",
  borderThreat: "边患",
  disasterLevel: "天灾",
  corruptionLevel: "贪腐",
};

export const INVERT_COLOR_KEYS = ["borderThreat", "disasterLevel", "corruptionLevel"];

export function buildNameById(ministers) {
  if (!Array.isArray(ministers)) return {};
  return Object.fromEntries(ministers.map((m) => [m.id, m.name || m.id]));
}

export function buildIdByName(ministers) {
  if (!Array.isArray(ministers)) return {};
  return Object.fromEntries(ministers.map((m) => [m.name || m.id, m.id]));
}
