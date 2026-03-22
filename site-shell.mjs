import siteConfig from './site.config.mjs?v=202603220812';

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;

  if (typeof value === 'string' && value) {
    element.textContent = value;
    element.hidden = false;
    return;
  }

  element.hidden = true;
}

function applySiteShell(config = {}) {
  document.documentElement.dataset.siteId = config.siteId || '';
  window.__SITE_CONFIG__ = config;

  if (config.siteTitle) {
    document.title = config.siteTitle;
  }

  const descriptionMeta = document.getElementById('site-meta-description');
  if (descriptionMeta && config.siteDescription) {
    descriptionMeta.setAttribute('content', config.siteDescription);
  }

  const favicon = document.getElementById('site-favicon');
  if (favicon && config.assets?.faviconHref) {
    favicon.setAttribute('href', config.assets.faviconHref);
    favicon.setAttribute('type', config.assets.faviconType || 'image/png');
  }

  const banner = document.getElementById('site-banner');
  if (banner && config.assets?.bannerHref) {
    banner.setAttribute('src', config.assets.bannerHref);
    banner.setAttribute('alt', config.assets.bannerAlt || config.siteTitle || '站点标题图');
  }

  setText('site-kicker', config.siteKicker || '');
  setText('site-title', config.siteTitle || '');
  setText('site-hero-description', config.heroDescription || config.siteDescription || '');
  setText('about-copy', config.aboutText || '');
  setText('site-footer-text', config.footerText || '');
}

applySiteShell(siteConfig);
