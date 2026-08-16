// サイト全体の共通設定。OGP・GA4・サイト名など、ページ横断で参照する値をここに集約する。
export const site = {
  name: 'たけるのみこと',
  nameEn: 'takerunomikoto',
  shortName: { ja: 'たけみこ', en: 'takemiko' },
  description:
    'VTuberとNFTを結ぶ、巫女「たけるのみこと」の公式サイト。走海神社のお知らせ・プロフィール・制作実績・グッズ情報。',
  url: 'https://takemiko.com',
  ogImage: '/og-default.png',
  // フォーム送信失敗時などのフォールバック用連絡先。
  contactEmail: 'contact@takemiko.com',
  // GA4 測定 ID。未設定時は GA4 タグを出力しない（web/.env の PUBLIC_GA_ID）。
  gaId: import.meta.env.PUBLIC_GA_ID as string | undefined,
  // お問い合わせフォームの送信先（Cloudflare Worker）。未設定時は /contact/ 自体を無効化する。
  contactEndpoint: import.meta.env.PUBLIC_CONTACT_ENDPOINT as string | undefined,
  // Cloudflare Turnstile のサイトキー（公開情報。HTML に出てよい）。
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined,
} as const;
