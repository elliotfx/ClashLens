/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['@prisma/client', 'bcrypt'],
    },
    images: {
        domains: ['api-assets.clashofclans.com'],
    },
}

module.exports = nextConfig
