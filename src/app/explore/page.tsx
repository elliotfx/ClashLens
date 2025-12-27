'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Search, Users, Trophy, Swords, Shield, Star, TrendingUp, Crown, MapPin } from 'lucide-react'
import Link from 'next/link'
import UserButton from '@/components/auth/UserButton'

interface ClanData {
    tag: string
    name: string
    description: string
    level: number
    members: number
    type: string
    requiredTrophies: number
    warWins: number
    warWinStreak: number
    warLeague?: { name: string }
    clanCapital?: { capitalHallLevel: number }
    location?: { name: string }
    badgeUrls?: { medium: string }
    labels?: { name: string; iconUrls: { small: string } }[]
    memberList?: {
        tag: string
        name: string
        role: string
        expLevel: number
        trophies: number
        donations: number
        donationsReceived: number
        league?: { iconUrls: { small: string } }
    }[]
}

export default function ExplorePage() {
    const { data: session } = useSession()
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [clan, setClan] = useState<ClanData | null>(null)
    const [error, setError] = useState('')

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault()
        if (!searchQuery.trim()) return

        setLoading(true)
        setError('')
        setClan(null)

        try {
            const response = await fetch(`/api/explore/clan?tag=${encodeURIComponent(searchQuery)}`)
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Clan non trouvé')
            }

            setClan(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const getRoleLabel = (role: string) => {
        const roles: { [key: string]: string } = {
            leader: '👑 Chef',
            coLeader: '⭐ Adjoint',
            admin: '🛡️ Ainé',
            member: 'Membre',
        }
        return roles[role] || role
    }

    const getRoleColor = (role: string) => {
        const colors: { [key: string]: string } = {
            leader: 'text-yellow-400',
            coLeader: 'text-purple-400',
            admin: 'text-blue-400',
            member: 'text-gray-400',
        }
        return colors[role] || 'text-gray-400'
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                            ClashLens
                        </span>
                    </Link>
                    {session ? (
                        <UserButton />
                    ) : (
                        <Link
                            href="/auth/signin"
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all text-sm"
                        >
                            Connexion
                        </Link>
                    )}
                </div>
            </header>

            <div className="container mx-auto px-4 py-8">
                {/* Search Section */}
                <div className="max-w-2xl mx-auto text-center mb-12">
                    <h1 className="text-4xl font-bold text-white mb-4">
                        🔍 Explorer un Clan
                    </h1>
                    <p className="text-gray-400 mb-8">
                        Recherchez n'importe quel clan pour voir ses statistiques en temps réel
                    </p>

                    <form onSubmit={handleSearch} className="relative">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Entrez le tag du clan (ex: #2Y8CJPVV)"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold transition-all disabled:opacity-50"
                            >
                                {loading ? 'Recherche...' : 'Rechercher'}
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className="mt-4 p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-400">
                            {error}
                        </div>
                    )}
                </div>

                {/* Clan Results */}
                {clan && (
                    <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
                        {/* Clan Header Card */}
                        <div className="glassmorphism rounded-2xl p-8">
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                {clan.badgeUrls?.medium && (
                                    <img
                                        src={clan.badgeUrls.medium}
                                        alt={clan.name}
                                        className="w-24 h-24 rounded-xl"
                                    />
                                )}
                                <div className="flex-1">
                                    <h2 className="text-3xl font-bold text-white mb-2">{clan.name}</h2>
                                    <p className="text-gray-400 mb-3">{clan.tag}</p>
                                    {clan.description && (
                                        <p className="text-gray-300 text-sm">{clan.description}</p>
                                    )}
                                    {clan.labels && clan.labels.length > 0 && (
                                        <div className="flex gap-2 mt-3">
                                            {clan.labels.map((label, i) => (
                                                <span
                                                    key={i}
                                                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-gray-800 text-xs text-gray-300"
                                                >
                                                    <img src={label.iconUrls.small} alt="" className="w-4 h-4" />
                                                    {label.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2 text-right">
                                    <span className="text-sm text-gray-400 flex items-center gap-2 justify-end">
                                        <MapPin className="w-4 h-4" />
                                        {clan.location?.name || 'International'}
                                    </span>
                                    <span className="text-sm text-gray-400">Type: {clan.type}</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div className="glassmorphism rounded-xl p-4 text-center">
                                <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-white">{clan.level}</p>
                                <p className="text-xs text-gray-400">Niveau</p>
                            </div>
                            <div className="glassmorphism rounded-xl p-4 text-center">
                                <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-white">{clan.members}/50</p>
                                <p className="text-xs text-gray-400">Membres</p>
                            </div>
                            <div className="glassmorphism rounded-xl p-4 text-center">
                                <Trophy className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-white">{clan.requiredTrophies}</p>
                                <p className="text-xs text-gray-400">Trophées requis</p>
                            </div>
                            <div className="glassmorphism rounded-xl p-4 text-center">
                                <Swords className="w-6 h-6 text-red-400 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-white">{clan.warWins}</p>
                                <p className="text-xs text-gray-400">Guerres gagnées</p>
                            </div>
                            <div className="glassmorphism rounded-xl p-4 text-center">
                                <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-white">{clan.warWinStreak}</p>
                                <p className="text-xs text-gray-400">Série en cours</p>
                            </div>
                            <div className="glassmorphism rounded-xl p-4 text-center">
                                <Shield className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-white">{clan.warLeague?.name || 'N/A'}</p>
                                <p className="text-xs text-gray-400">Ligue GDC</p>
                            </div>
                        </div>

                        {/* Members Table */}
                        {clan.memberList && clan.memberList.length > 0 && (
                            <div className="glassmorphism rounded-2xl overflow-hidden">
                                <div className="p-6 border-b border-gray-700">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Users className="w-5 h-5" />
                                        Membres du Clan ({clan.memberList.length})
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-800/50">
                                            <tr>
                                                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">#</th>
                                                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Joueur</th>
                                                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Rôle</th>
                                                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Niveau</th>
                                                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Trophées</th>
                                                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Dons</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clan.memberList.map((member, index) => (
                                                <tr
                                                    key={member.tag}
                                                    className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors"
                                                >
                                                    <td className="py-3 px-4 text-gray-500 text-sm">{index + 1}</td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            {member.league?.iconUrls?.small && (
                                                                <img
                                                                    src={member.league.iconUrls.small}
                                                                    alt=""
                                                                    className="w-6 h-6"
                                                                />
                                                            )}
                                                            <span className="text-white font-medium">{member.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className={`py-3 px-4 text-sm ${getRoleColor(member.role)}`}>
                                                        {getRoleLabel(member.role)}
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-300">{member.expLevel}</td>
                                                    <td className="py-3 px-4 text-yellow-400 font-medium">
                                                        {member.trophies.toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="text-green-400">{member.donations}</span>
                                                        <span className="text-gray-500 mx-1">/</span>
                                                        <span className="text-red-400">{member.donationsReceived}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* CTA to Connect */}
                        <div className="glassmorphism rounded-2xl p-8 text-center bg-gradient-to-r from-blue-900/30 to-purple-900/30">
                            <h3 className="text-2xl font-bold text-white mb-4">
                                Vous voulez suivre ce clan ?
                            </h3>
                            <p className="text-gray-400 mb-6">
                                Connectez-vous pour ajouter ce clan à votre tableau de bord et accéder aux statistiques détaillées,
                                historiques, scores IRJ et alertes Discord.
                            </p>
                            <Link
                                href="/auth/signin"
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold transition-all"
                            >
                                <Crown className="w-5 h-5" />
                                Se connecter & Suivre
                            </Link>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!clan && !loading && !error && (
                    <div className="text-center py-20">
                        <Search className="w-16 h-16 text-gray-600 mx-auto mb-6" />
                        <h3 className="text-xl text-gray-400 mb-2">
                            Recherchez un clan pour commencer
                        </h3>
                        <p className="text-gray-500 text-sm">
                            Entrez le tag du clan (commence par #) pour voir ses statistiques
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
