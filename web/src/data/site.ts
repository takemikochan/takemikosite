// サイト全体の共通設定。OGP・GA4・サイト名など、ページ横断で参照する値をここに集約する。
export const site = {
  name: 'たけるのみこと',
  nameEn: 'takerunomikoto',
  shortName: { ja: 'たけみこ', en: 'takemiko' },
  description:
    'VTuberとNFTを結ぶ、巫女「たけるのみこと」の公式サイト。走海神社のお知らせ・プロフィール・制作実績・グッズ情報。',
  url: 'https://takemiko.com',
  ogImage: '/og-default.png',
  // 仮の問い合わせ先。実アドレスが決まり次第ここを差し替える（Phase 7 で /contact/ に置き換え予定）。
  contactEmail: 'contact@takemiko.com',
  // GA4 測定 ID。未設定時は GA4 タグを出力しない（web/.env の PUBLIC_GA_ID）。
  gaId: import.meta.env.PUBLIC_GA_ID as string | undefined,
} as const;
