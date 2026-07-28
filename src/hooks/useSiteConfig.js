import { useEffect, useState } from 'react';

export function useSiteConfig(fallback) {
  const [config, setConfig] = useState(fallback);

  useEffect(() => {
    let active = true;

    fetch('/api/config')
      .then((response) => {
        if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
        return response.json();
      })
      .then((nextConfig) => active && setConfig(nextConfig))
      .catch(() => active && setConfig(fallback));

    return () => {
      active = false;
    };
  }, [fallback]);

  return config;
}
