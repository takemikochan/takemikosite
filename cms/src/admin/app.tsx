import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: ['ja'], // 公式 ja ロケール。en はフォールバック兼デフォルトのため常に残る
    translations: {
      ja: {
        'app.components.LeftMenu.navbrand.title': 'たけるのみこと CMS',
        'Auth.form.welcome.title': 'たけるのみこと CMS',
      },
    },
  },
  bootstrap(_app: StrapiApp) {},
};
