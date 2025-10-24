let userConfig = undefined;
try {
  userConfig = await import('./v0-user-next.config');
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'thumbnailer.mixcloud.com',
      },
      {
        protocol: 'https',
        hostname: 'i1.wp.com',
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://widget.mixcloud.com https://player-widget.mixcloud.com https://static.cloudflareinsights.com https://connect.facebook.net https://www.googletagmanager.com https://cdn.socket.io",
              "frame-src 'self' https://www.mixcloud.com https://widget.mixcloud.com https://player-widget.mixcloud.com https://www.youtube.com https://player.vimeo.com",
              "child-src 'self' https://www.mixcloud.com https://widget.mixcloud.com https://player-widget.mixcloud.com https://www.youtube.com https://player.vimeo.com",
              "connect-src 'self' https://api.mixcloud.com https://widget.mixcloud.com https://player-widget.mixcloud.com https://api.radiocult.fm https://stream.radiocult.fm wss://api.radiocult.fm https://static.cloudflareinsights.com https://api.cosmicjs.com https://*.mixcloud.com",
              "img-src 'self' data: https: blob:",
              "media-src 'self' https: blob:",
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
