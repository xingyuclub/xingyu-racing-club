import { useEffect, useState } from 'react';

export function useSiteConfig(fallback) {
  const [config, setConfig] = useState(fallback);

  useEffect(() => {
    let active = true;

    const loadConfig = () => {
      fetch('/api/config', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
          return response.json();
        })
        .then((nextConfig) => active && setConfig(nextConfig))
        .catch(() => active && setConfig(fallback));
    };

    loadConfig();
    window.addEventListener('focus', loadConfig);

    return () => {
      active = false;
      window.removeEventListener('focus', loadConfig);
    };
  }, [fallback]);

  return config;
}
