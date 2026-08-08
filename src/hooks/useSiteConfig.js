import { useEffect, useState } from 'react';

const getPublicConfigScriptUrl = () => String(
  window.__XINGYU_PUBLIC_CONFIG_SCRIPT_URL__
    || import.meta.env.VITE_PUBLIC_CONFIG_SCRIPT_URL
    || '',
).trim();

export function loadPublicConfigScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const separator = url.includes('?') ? '&' : '?';
    script.async = true;
    script.src = `${url}${separator}v=${Date.now()}`;
    script.onload = () => {
      script.remove();
      if (!window.__XINGYU_SITE_CONFIG__) {
        reject(new Error('Public config script did not provide site config'));
        return;
      }
      resolve(window.__XINGYU_SITE_CONFIG__);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Public config script failed to load'));
    };
    document.head.appendChild(script);
  });
}

export function useSiteConfig(fallback) {
  const [config, setConfig] = useState(fallback);

  useEffect(() => {
    let active = true;
    const publicConfigScriptUrl = getPublicConfigScriptUrl();

    const loadConfig = () => {
      const request = publicConfigScriptUrl
        ? loadPublicConfigScript(publicConfigScriptUrl)
        : fetch('/api/config', { cache: 'no-store' }).then((response) => {
            if (!response.ok) throw new Error('Config request failed: ' + response.status);
            return response.json();
          });

      request
        .then((nextConfig) => active && setConfig(nextConfig))
        .catch(() => {});
    };

    loadConfig();
    window.addEventListener('focus', loadConfig);

    const eventSource = !publicConfigScriptUrl && typeof EventSource !== 'undefined'
      ? new EventSource('/api/config/events')
      : null;
    if (eventSource) eventSource.addEventListener('config-updated', loadConfig);
    if (eventSource) eventSource.addEventListener('error', () => {
      // Keep the existing config; the focus listener remains as a fallback.
    });

    return () => {
      active = false;
      window.removeEventListener('focus', loadConfig);
      if (eventSource) eventSource.close();
    };
  }, [fallback]);

  return config;
}
