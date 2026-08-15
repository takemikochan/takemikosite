// 日本語日付整形。<time datetime> には ISO 文字列をそのまま使う。
export function formatDateJa(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
