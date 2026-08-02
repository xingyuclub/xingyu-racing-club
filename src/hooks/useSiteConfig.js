import { useEffect, useState } from 'react';

export function useSiteConfig(fallback) {
  const [config, setConfig] = useState(fallback);

  useEffect(() => {
    let active = true;

    const loadConfig = () => {
      fetch('/api/config', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('Config request failed: ' + response.status);
          return response.json();
        })
        .then((nextConfig) => active && setConfig(nextConfig))
        .catch(() => active && setConfig(fallback));
    };

    loadConfig();
    window.addEventListener('focus', loadConfig);

    const eventSource = typeof EventSource !== 'undefined'
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
