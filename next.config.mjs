let userConfig = undefined;
try {
  userConfig = await import('./v0-user-next.config');
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  cacheComponents: true,
  cacheLife: {
    // Hero changes weekly - 15min revalidate ensures updates show within reasonable time
    hero: { stale: 60, revalidate: 900, expire: 3600 },
    // Latest episodes update daily - 5min revalidate for fresh content
    latest: { stale: 30, revalidate: 300, expire: 1800 },
    // Schedule updates throughout the week
    schedule: { stale: 60, revalidate: 300, expire: 3600 },
    // Archive content rarely changes - aggressive caching (1 week expire)
    archive: { stale: 300, revalidate: 86400, expire: 604800 },
    // Editorial updates occasionally
    editorial: { stale: 300, revalidate: 3600, expire: 86400 },
    // General homepage sections
    homepage: { stale: 60, revalidate: 600, expire: 3600 },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'thumbnailer.mixcloud.com',
      },
      {
        protocol: 'https',
        hostname: 'i1.wp.com',
      },
      {
        protocol: 'https',
        hostname: 'imgix.cosmicjs.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.cosmicjs.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'vumbnail.com',
      },
    ],
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    serverActions: {
      bodySizeLimit: '100mb',
    },
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  serverExternalPackages: ['prettier', '@react-email/render'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://widget.mixcloud.com https://player-widget.mixcloud.com https://static.cloudflareinsights.com https://connect.facebook.net https://www.googletagmanager.com https://cdn.socket.io https://plausible.io",
              "frame-src 'self' https://www.mixcloud.com https://widget.mixcloud.com https://player-widget.mixcloud.com https://www.youtube.com https://player.vimeo.com",
              "child-src 'self' https://www.mixcloud.com https://widget.mixcloud.com https://player-widget.mixcloud.com https://www.youtube.com https://player.vimeo.com",
              "connect-src 'self' https://api.mixcloud.com https://widget.mixcloud.com https://player-widget.mixcloud.com https://api.radiocult.fm https://stream.radiocult.fm https://worldwide-fm.radiocult.fm wss://api.radiocult.fm https://static.cloudflareinsights.com https://api.cosmicjs.com https://*.mixcloud.com https://plausible.io",
              "img-src 'self' data: https: blob:",
              "media-src 'self' https://worldwide-fm.radiocult.fm https: blob:",
              "style-src 'self' 'unsafe-inline' https:",
              "font-src 'self' https: data:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

mergeConfig(nextConfig, userConfig);

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return;
  }

  for (const key in userConfig) {
    if (typeof nextConfig[key] === 'object' && !Array.isArray(nextConfig[key])) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      };
    } else {
      nextConfig[key] = userConfig[key];
    }
  }
}

export default nextConfig;
