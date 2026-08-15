// プロフィール・神社設定・活動内容。頻度が低く型を保ちたい情報として in-repo で管理する。
// SNS リンクは Strapi (sns-link) 管理のためここには含めない。
export const profile = {
  name: 'たけるのみこと',
  nameEn: 'takerunomikoto', // 活動名の英字表記。仕様上、常に小文字
  shortName: { ja: 'たけみこ', en: 'takemiko' }, // 略称。ドメイン takemiko.com / Worker takemiko.workers.dev はここに由来
  nickname: 'みことちゃん', // ファンからの呼び方
  hashtags: ['#たけみこ', '#takemiko'],
  trueName: { name: '大和海琴', reading: 'やまとみこと' }, // 巫女としての真名。「海」の字が走海神社と呼応する
  tagline: 'VTuberとNFTを結ぶ、巫女。',
  avatar: '/placeholder/avatar.svg', // ← 実素材が来たら src/assets/ に置いてここを書き換える
  keyVisual: '/placeholder/kv.svg',
  items: [
    { label: '誕生日', value: '4月2日' },
    { label: '身長', value: '156cm' },
    { label: '好きなもの', value: '——' },
  ],
  bio: ['ここに自己紹介の1段落目。', '2段落目。活動の経緯や大切にしていること。'],
  // 神社設定。プロフィールページに「ご利益」セクションとして展開する
  shrine: {
    name: '走海神社',
    reading: 'はしりうみじんじゃ',
    guardian: { name: '狛ペンギン', desc: '狛犬ならぬ狛ペンギンが神社を守っている。' },
    blessings: ['必勝祈願', '合格祈願'],
  },
  activities: [
    {
      title: '配信',
      desc: 'ゲーム配信・雑談配信を不定期で行っています。',
      icon: 'stream',
    },
    {
      title: 'イラスト',
      desc: 'オリジナル・ファンアートを制作しています。',
      icon: 'illust',
    },
    {
      title: 'プログラミング/AI',
      desc: '生成AIを使ったLP制作など、プログラミング関連のコンテンツ作りが主活動。',
      icon: 'code',
    },
    {
      title: 'NFT',
      desc: 'VTuberとNFTを結ぶ活動として、作品をNFTでも展開しています。',
      icon: 'nft',
    },
  ],
} as const;
