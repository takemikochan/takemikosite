import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  // 管理画面は同一オリジンのみで完結し、Astroのビルドもサーバー間通信のため、
  // ブラウザからの外部オリジンCORSは本来不要。既定の origin:'*' + credentials:true
  // （任意Originを資格情報付きで反射する）を避け、自ドメインのみへ制限する。
  {
    name: 'strapi::cors',
    config: {
      origin: ['https://cms.takemiko.com'],
      credentials: true,
    },
  },
  // strapi::poweredBy は X-Powered-By ヘッダーを付与するだけなので、
  // 偵察を容易にする情報開示を避けるため意図的に外す（§INFO-01）。
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
