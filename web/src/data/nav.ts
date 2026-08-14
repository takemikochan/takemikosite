// グローバルナビゲーション構造。Header（ドロワー込み）と Footer から参照する。
export const nav = [
  { label: 'プロフィール', href: '/profile/' },
  { label: 'お知らせ', href: '/news/' },
  { label: '制作実績', href: '/works/' },
  { label: 'グッズ', href: '/goods/' },
] as const;
