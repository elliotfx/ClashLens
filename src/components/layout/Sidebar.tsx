'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Swords, Settings as SettingsIcon, Shield, Trophy, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
    clanTag?: string
}

export default function Sidebar({ clanTag }: SidebarProps) {
    const pathname = usePathname()

    // General navigation (always visible at top)
    const generalNavigation = [
        {
            name: 'Home',
            href: '/',
            icon: Home,
        },
        {
            name: 'Settings',
            href: clanTag ? `/settings/${encodeURIComponent(clanTag)}` : '/settings',
            icon: SettingsIcon,
        },
    ]

    // Clan-specific navigation (only when clanTag is provided)
    const clanNavigation = clanTag ? [
        {
            name: 'Dashboard',
            href: `/dashboard/${encodeURIComponent(clanTag)}`,
            icon: LayoutDashboard,
        },
        {
            name: 'Members',
            href: `/members/${encodeURIComponent(clanTag)}`,
            icon: Users,
        },
        {
            name: 'Ranked',
            href: `/ranked/${encodeURIComponent(clanTag)}`,
            icon: Trophy,
        },
        {
            name: 'Wars',
            href: `/wars/${encodeURIComponent(clanTag)}`,
            icon: Swords,
        },
        {
            name: 'War Analysis',
            href: `/wars/${encodeURIComponent(clanTag)}/analysis`,
            icon: Swords,
        },
    ] : []

    return (
        <div className="w-64 bg-gray-900 border-r border-gray-800 h-screen sticky top-0 p-6 flex flex-col overflow-y-auto">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 mb-6 flex-shrink-0">
                <Shield className="w-8 h-8 text-blue-500" />
                <span className="text-xl font-bold text-white">ClashLens</span>
            </Link>

            {/* General Navigation - Always at top */}
            <nav className="space-y-1 mb-4 flex-shrink-0">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-4">Navigation</p>
                {generalNavigation.map((item) => {
                    const Icon = item.icon
                    const active = pathname === item.href

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                                active
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            {item.name}
                        </Link>
                    )
                })}
            </nav>

            {/* Clan Navigation */}
            {clanNavigation.length > 0 && (
                <nav className="space-y-1 pt-4 border-t border-gray-800 flex-shrink-0">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-4">Clan</p>
                    {clanNavigation.map((item) => {
                        const Icon = item.icon
                        const active = pathname?.startsWith(item.href) || false

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                                    active
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>
            )}

            {/* No Clan Selected Message */}
            {!clanTag && (
                <div className="pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-4">Clan</p>
                    <p className="text-sm text-gray-500 px-4 py-2">
                        Sélectionnez un clan depuis la page d'accueil.
                    </p>
                </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Footer */}
            <div className="pt-4 border-t border-gray-800 flex-shrink-0">
                <p className="text-xs text-gray-500 text-center">
                    © 2025 ClashLens
                </p>
            </div>
        </div>
    )
}
