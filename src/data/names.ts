const SURNAMES = [
  '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村',
  '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上',
  '木村', '林', '斎藤', '清水', '森', '池田', '橋本', '阿部',
];

const GIVEN_NAMES = [
  '翔太', '大輔', '健太', '拓也', '直樹', '雄太', '誠', '亮',
  '悠斗', '颯太', '陸', '湊', '樹', '悠', '大和', '蒼',
  '新', '朝陽', '陽翔', '大地', '海斗', '龍', '一輝', '光',
];

export function randomPlayerName(rng: () => number): string {
  const s = SURNAMES[Math.floor(rng() * SURNAMES.length)];
  const g = GIVEN_NAMES[Math.floor(rng() * GIVEN_NAMES.length)];
  return `${s} ${g}`;
}
