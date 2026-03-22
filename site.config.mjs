const siteConfig = {
  siteId: 'jerry-notes',
  siteTitle: 'Jerry的个人站',
  siteDescription: '记录想法、项目和日常笔记',
  siteKicker: 'PUBLIC + INTERNAL NOTES',
  heroDescription: '公开记录产品、项目与日常思考；登录后可查看内部工作手册、学习资料与阶段性复盘。',
  aboutText: '这里长期记录产品、项目、行业理解和日常思考。公开内容偏方法、观点和案例；登录后可继续查看内部工作手册、学习资料与阶段性复盘。',
  footerText: '我的个人站',
  domain: 'jerry-notes.pages.dev',
  themeStorageKey: 'jerry-notes-theme',
  assets: {
    faviconHref: './assets/mouse-favicon.svg',
    faviconType: 'image/svg+xml',
    bannerHref: './assets/cat-mouse-banner.svg?v=202603212115',
    bannerAlt: '卡通风格猫追老鼠横幅插画（原创）',
  },
  deploy: {
    pagesProjectName: 'jerry-notes',
    wranglerName: 'jerry-notes',
  },
};

export default siteConfig;
