'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Link from 'next/link'
import { Search, ArrowUpDown, Info, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react'

type PerformanceCategory = 'overperformer' | 'on-target' | 'underperformer' | 'unranked' | 'all'

const categoryLabels: { [key in PerformanceCategory]: string } = {
    all: 'Tous',
    overperformer: 'Surperformants',
    'on-target': 'Conformes',
    underperformer: 'Sous-performants',
    unranked: 'Non classés',
}

const categoryColors: { [key in PerformanceCategory]: string } = {
    all: 'text-white',
    overperformer: 'text-green-400',
    'on-target': 'text-yellow-400',
    underperformer: 'text-red-400',
    unranked: 'text-gray-400',
}

export default function MembersPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const clanTag = decodeURIComponent(params.clanTag as string)
    const [members, setMembers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [sortBy, setSortBy] = useState('leagueDelta')
    const [sortOrder, setSortOrder] = useState('desc')
    const [tooltipPlayerId, setTooltipPlayerId] = useState<string | null>(null)

    // Initialize filter from URL params (e.g., ?filter=overperformer)
    const initialFilter = (searchParams.get('filter') as PerformanceCategory) || 'all'
    const [categoryFilter, setCategoryFilter] = useState<PerformanceCategory>(initialFilter)

    useEffect(() => {
        async function fetchMembers() {
            try {
                const params = new URLSearchParams({
                    search,
                    sortBy,
                    sortOrder,
                })
                const response = await fetch(
                    `/api/clan/${encodeURIComponent(clanTag)}/members?${params}`
                )
                if (!response.ok) throw new Error('Failed to fetch members')
                const result = await response.json()
                setMembers(result.members || [])
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        const handler = setTimeout(() => {
            fetchMembers()
        }, 300)

        return () => clearTimeout(handler)
    }, [clanTag, search, sortBy, sortOrder])

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('desc')
        }
    }

    // Calculate performance stats
    const stats = useMemo(() => {
        const counts = {
            overperformer: 0,
            'on-target': 0,
            underperformer: 0,
            unranked: 0,
        }
        members.forEach(m => {
            const cat = m.leaguePerformance?.category
            if (cat && counts[cat as keyof typeof counts] !== undefined) {
                counts[cat as keyof typeof counts]++
            }
        })
        return counts
    }, [members])

    // Filter members by category
    const filteredMembers = useMemo(() => {
        if (categoryFilter === 'all') return members
        return members.filter(m => m.leaguePerformance?.category === categoryFilter)
    }, [members, categoryFilter])

    if (loading && members.length === 0) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <Sidebar clanTag={clanTag} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-white">Loading members...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-gray-900">
            <Sidebar clanTag={clanTag} />

            <div className="flex-1 p-8 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Clan Members</h1>
                        <p className="text-gray-400">
                            Performance ranked et IRJ scores des membres
                        </p>
                    </div>

                    {/* Performance Overview Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div
                            className={`glassmorphism rounded-xl p-4 cursor-pointer transition-all ${categoryFilter === 'overperformer' ? 'ring-2 ring-green-500' : 'hover:bg-gray-700/50'}`}
                            onClick={() => setCategoryFilter(categoryFilter === 'overperformer' ? 'all' : 'overperformer')}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="w-5 h-5 text-green-400" />
                                <span className="text-sm text-gray-400">Surperformants</span>
                            </div>
                            <p className="text-2xl font-bold text-green-400">{stats.overperformer}</p>
                            <p className="text-xs text-gray-500">+2 ligues ou plus</p>
                        </div>
                        <div
                            className={`glassmorphism rounded-xl p-4 cursor-pointer transition-all ${categoryFilter === 'on-target' ? 'ring-2 ring-yellow-500' : 'hover:bg-gray-700/50'}`}
                            onClick={() => setCategoryFilter(categoryFilter === 'on-target' ? 'all' : 'on-target')}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Minus className="w-5 h-5 text-yellow-400" />
                                <span className="text-sm text-gray-400">Conformes</span>
                            </div>
                            <p className="text-2xl font-bold text-yellow-400">{stats['on-target']}</p>
                            <p className="text-xs text-gray-500">±1 ligue</p>
                        </div>
                        <div
                            className={`glassmorphism rounded-xl p-4 cursor-pointer transition-all ${categoryFilter === 'underperformer' ? 'ring-2 ring-red-500' : 'hover:bg-gray-700/50'}`}
                            onClick={() => setCategoryFilter(categoryFilter === 'underperformer' ? 'all' : 'underperformer')}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingDown className="w-5 h-5 text-red-400" />
                                <span className="text-sm text-gray-400">Sous-performants</span>
                            </div>
                            <p className="text-2xl font-bold text-red-400">{stats.underperformer}</p>
                            <p className="text-xs text-gray-500">-2 ligues ou plus</p>
                        </div>
                        <div
                            className={`glassmorphism rounded-xl p-4 cursor-pointer transition-all ${categoryFilter === 'unranked' ? 'ring-2 ring-gray-500' : 'hover:bg-gray-700/50'}`}
                            onClick={() => setCategoryFilter(categoryFilter === 'unranked' ? 'all' : 'unranked')}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Filter className="w-5 h-5 text-gray-400" />
                                <span className="text-sm text-gray-400">Non classés</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-400">{stats.unranked}</p>
                            <p className="text-xs text-gray-500">Pas en ranked</p>
                        </div>
                    </div>

                    {/* Search & Filter */}
                    <div className="glassmorphism rounded-xl p-6 mb-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search members by name..."
                                    className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            {categoryFilter !== 'all' && (
                                <button
                                    onClick={() => setCategoryFilter('all')}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
                                >
                                    Afficher tous ({members.length})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Members Table */}
                    <div className="glassmorphism rounded-xl overflow-visible">
                        <div className="overflow-x-auto overflow-y-visible">
                            <table className="w-full">
                                <thead className="bg-gray-800/50">
                                    <tr>
                                        <th
                                            onClick={() => handleSort('name')}
                                            className="text-left py-4 px-4 text-gray-400 font-medium cursor-pointer hover:text-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                Player
                                                <ArrowUpDown className="w-4 h-4" />
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('townHall')}
                                            className="text-left py-4 px-4 text-gray-400 font-medium cursor-pointer hover:text-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                TH
                                                <ArrowUpDown className="w-4 h-4" />
                                            </div>
                                        </th>
                                        <th className="text-left py-4 px-4 text-gray-400 font-medium">
                                            Ligue Actuelle
                                        </th>
                                        <th className="text-left py-4 px-4 text-gray-400 font-medium">
                                            Ligue Attendue
                                        </th>
                                        <th
                                            onClick={() => handleSort('leagueDelta')}
                                            className="text-left py-4 px-4 text-gray-400 font-medium cursor-pointer hover:text-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                Écart
                                                <ArrowUpDown className="w-4 h-4" />
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('irj')}
                                            className="text-left py-4 px-4 text-gray-400 font-medium cursor-pointer hover:text-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                IRJ
                                                <ArrowUpDown className="w-4 h-4" />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMembers.map((member, index) => {
                                        const perf = member.leaguePerformance || {}
                                        const deltaColor = perf.leagueDelta > 0 ? 'text-green-400' : perf.leagueDelta < 0 ? 'text-red-400' : 'text-yellow-400'
                                        const deltaIcon = perf.leagueDelta > 0 ? '↑' : perf.leagueDelta < 0 ? '↓' : '='

                                        return (
                                            <tr
                                                key={member.tag}
                                                className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors"
                                            >
                                                <td className="py-3 px-4">
                                                    <Link
                                                        href={`/player/${encodeURIComponent(member.tag)}`}
                                                        className="text-white hover:text-blue-400 transition-colors font-medium"
                                                    >
                                                        {member.name}
                                                    </Link>
                                                    <div className="text-xs text-gray-500">{member.role || 'member'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="text-white font-semibold">TH{member.townHallLevel || '?'}</span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`${perf.category === 'unranked' ? 'text-gray-500' : 'text-white'}`}>
                                                        {perf.currentLeague || 'Non classé'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="text-gray-400">
                                                        {perf.expectedLeague || '-'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {perf.category !== 'unranked' ? (
                                                        <span className={`font-bold text-lg ${deltaColor}`}>
                                                            {deltaIcon} {perf.leagueDelta > 0 ? '+' : ''}{perf.leagueDelta}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500">—</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div
                                                        className="flex items-center gap-2 relative cursor-pointer"
                                                        onMouseEnter={() => setTooltipPlayerId(member.tag)}
                                                        onMouseLeave={() => setTooltipPlayerId(null)}
                                                    >
                                                        <div className="w-12 bg-gray-700 rounded-full h-2">
                                                            <div
                                                                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                                                                style={{ width: `${member.irjScore}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-white font-semibold w-8">{member.irjScore}</span>
                                                        <Info className="w-3 h-3 text-gray-500" />

                                                        {tooltipPlayerId === member.tag && member.irjComponents && (
                                                            <div className={`absolute right-0 z-50 w-80 p-4 rounded-lg bg-gray-900 border border-gray-600 shadow-2xl text-sm ${index < 3 ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                                                <h4 className="font-bold text-white mb-3 text-base">Score IRJ : {member.irjScore}/100</h4>

                                                                <div className="space-y-3">
                                                                    {/* Présence */}
                                                                    <div className="bg-gray-800/50 rounded-lg p-2">
                                                                        <div className="flex justify-between mb-1">
                                                                            <span className="text-blue-400 font-medium">📊 Présence</span>
                                                                            <span className="text-white font-bold">{member.irjComponents.presenceScore}/40</span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-400">
                                                                            {member.irjComponents.details?.presence?.reason || 'Basé sur la fréquence des snapshots'}
                                                                        </p>
                                                                    </div>

                                                                    {/* Trophées */}
                                                                    <div className="bg-gray-800/50 rounded-lg p-2">
                                                                        <div className="flex justify-between mb-1">
                                                                            <span className="text-yellow-400 font-medium">🏆 Trophées</span>
                                                                            <span className="text-white font-bold">{member.irjComponents.trophyScore}/30</span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-400">
                                                                            {member.irjComponents.details?.trophy?.reason || 'Progression sur 7 jours'}
                                                                        </p>
                                                                    </div>

                                                                    {/* Dons */}
                                                                    <div className="bg-gray-800/50 rounded-lg p-2">
                                                                        <div className="flex justify-between mb-1">
                                                                            <span className="text-green-400 font-medium">🎁 Dons</span>
                                                                            <span className="text-white font-bold">{member.irjComponents.donationScore}/15</span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-400">
                                                                            {member.irjComponents.details?.donation?.reason || 'Contributions au clan'}
                                                                        </p>
                                                                    </div>

                                                                    {/* Guerres */}
                                                                    <div className="bg-gray-800/50 rounded-lg p-2">
                                                                        <div className="flex justify-between mb-1">
                                                                            <span className="text-red-400 font-medium">⚔️ Guerres</span>
                                                                            <span className="text-white font-bold">{member.irjComponents.warScore}/15</span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-400">
                                                                            {member.irjComponents.details?.war?.reason || 'Participation aux guerres'}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-3 pt-2 border-t border-gray-700">
                                                                    <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                                                                        <div
                                                                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                                                                            style={{ width: `${member.irjScore}%` }}
                                                                        />
                                                                    </div>
                                                                    <p className="text-xs text-gray-500 text-center">
                                                                        {member.irjScore >= 80 ? '⭐ Excellent membre' :
                                                                            member.irjScore >= 60 ? '👍 Bon membre' :
                                                                                member.irjScore >= 40 ? '📈 Membre actif' :
                                                                                    '⚠️ Membre peu actif'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>

                            {filteredMembers.length === 0 && (
                                <div className="py-12 text-center text-gray-500">
                                    {search || categoryFilter !== 'all' ? 'Aucun membre trouvé avec ces critères' : 'Aucune donnée disponible'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
