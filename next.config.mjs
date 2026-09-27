/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // GZCTF 后端地址：默认 8080（GZCTF 官方默认端口）；
        // 自建部署端口不同（如 36306）时在 .env.local 设 GZCTF_API_ORIGIN 覆盖
        destination: `${process.env.GZCTF_API_ORIGIN || 'http://localhost:8080'}/api/:path*`,
      },
    ];
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;