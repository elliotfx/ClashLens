'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import KPICard from '@/components/KPICard'
import TrophyChart from '@/components/charts/TrophyChart'
import THDistribution from '@/components/charts/THDistribution'
import { Users, Trophy, TrendingUp, Home, Target, Award, Clock, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
    const params = useParams()
    const clanTag = decodeURIComponent(params.clanTag as string)
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function fetchData() {
            try {
                const response = await fetch(`/api/clan/${encodeURIComponent(clanTag)}/stats`)
                if (!response.ok) throw new Error('Failed to fetch dashboard data')
                const result = await response.json()
                setData(result)
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [clanTag])

    // Format date relative (e.g., "il y a 5 minutes")
    const formatRelativeTime = (date: string | null) => {
        if (!date) return 'Jamais'
        const now = new Date()
        const then = new Date(date)
        const diffMs = now.getTime() - then.getTime()
        const diffMin = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMin / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMin < 1) return 'À l\'instant'
        if (diffMin < 60) return `Il y a ${diffMin} min`
        if (diffHours < 24) return `Il y a ${diffHours}h`
        return `Il y a ${diffDays}j`
    }

    if (loading) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <Sidebar clanTag={clanTag} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-white">Loading dashboard...</div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <Sidebar clanTag={clanTag} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-red-400">Error: {error}</div>
                </div>
            </div>
        )
    }

    const snapshotInfo = data.snapshotInfo
    const isDataFresh = snapshotInfo?.totalSnapshots >= 10

    return (
        <div className="flex min-h-screen bg-gray-900">
            <Sidebar clanTag={clanTag} />

            <div className="flex-1 p-8 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-2">
                            <h1 className="text-3xl font-bold text-white">
                                {data.clan?.name || 'Clan Dashboard'}
                            </h1>
                            {data.clan?.level && (
                                <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-medium">
                                    Niv. {data.clan.level}
                                </span>
                            )}
                        </div>
                        <p className="text-gray-400">
                            {data.clan?.tag && (
                                <span className="text-purple-400 font-mono mr-2">{data.clan.tag}</span>
                            )}
                            Vue d'ensemble des performances et statistiques du clan
                        </p>
                    </div>

                    {/* Snapshot Info Banner */}
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-4 ${isDataFresh ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                        <div className="flex-shrink-0">
                            {isDataFresh ? (
                                <Clock className="w-6 h-6 text-blue-400" />
                            ) : (
                                <AlertCircle className="w-6 h-6 text-yellow-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-4 flex-wrap">
                                <span className={`text-sm ${isDataFresh ? 'text-blue-300' : 'text-yellow-300'}`}>
                                    <strong>Dernière sync :</strong> {formatRelativeTime(snapshotInfo?.lastSnapshot)}
                                </span>
                                <span className="text-xs text-gray-500">•</span>
                                <span className="text-sm text-gray-400">
                                    {snapshotInfo?.totalSnapshots || 0} snapshots collectées
                                </span>
                            </div>
                            {!isDataFresh && (
                                <p className="text-xs text-yellow-400/80 mt-1">
                                    ⚠️ Les données de progression (delta trophées, dons, IRJ) nécessitent plusieurs jours d'accumulation pour être fiables.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* KPIs Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <KPICard
                            title="Members"
                            value={data.kpis.memberCount}
                            icon={Users}
                        />
                        <KPICard
                            title="Trophies"
                            value={data.kpis.currentTrophies.toLocaleString()}
                            trend={{
                                value: data.kpis.trophyVariation7d,
                                label: '7 days',
                            }}
                            icon={Trophy}
                        />
                        <KPICard
                            title="Avg Town Hall"
                            value={`TH${data.kpis.avgTownHall}`}
                            icon={Home}
                        />
                        <KPICard
                            title="War Wins"
                            value={data.kpis.warWins}
                            subtitle={`${data.kpis.warWinStreak} win streak`}
                            icon={Award}
                        />
                    </div>

                    {/* Ranked Performance Overview */}
                    {data.rankedPerformance && (
                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Target className="w-5 h-5" />
                                Performance Ranked - Vue d'ensemble
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Link href={`/members/${encodeURIComponent(clanTag)}?filter=overperformer`} className="glassmorphism rounded-xl p-4 hover:bg-gray-700/30 transition-colors">
                                    <p className="text-sm text-gray-400 mb-1">Surperformants</p>
                                    <p className="text-3xl font-bold text-green-400">{data.rankedPerformance.overperformer || 0}</p>
                                    <p className="text-xs text-green-500/70 mt-1">+2 ligues ou plus</p>
                                </Link>
                                <Link href={`/members/${encodeURIComponent(clanTag)}?filter=on-target`} className="glassmorphism rounded-xl p-4 hover:bg-gray-700/30 transition-colors">
                                    <p className="text-sm text-gray-400 mb-1">Conformes</p>
                                    <p className="text-3xl font-bold text-yellow-400">{data.rankedPerformance['on-target'] || 0}</p>
                                    <p className="text-xs text-yellow-500/70 mt-1">±1 ligue de l'attendu</p>
                                </Link>
                                <Link href={`/members/${encodeURIComponent(clanTag)}?filter=underperformer`} className="glassmorphism rounded-xl p-4 hover:bg-gray-700/30 transition-colors">
                                    <p className="text-sm text-gray-400 mb-1">Sous-performants</p>
                                    <p className="text-3xl font-bold text-red-400">{data.rankedPerformance.underperformer || 0}</p>
                                    <p className="text-xs text-red-500/70 mt-1">-2 ligues ou plus</p>
                                </Link>
                                <Link href={`/members/${encodeURIComponent(clanTag)}?filter=unranked`} className="glassmorphism rounded-xl p-4 hover:bg-gray-700/30 transition-colors">
                                    <p className="text-sm text-gray-400 mb-1">Non classés</p>
                                    <p className="text-3xl font-bold text-gray-400">{data.rankedPerformance.unranked || 0}</p>
                                    <p className="text-xs text-gray-500 mt-1">Pas en ranked</p>
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Trophy History */}
                        <div className="glassmorphism rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Trophy History (30 Days)</h2>
                            {data.charts.trophyHistory.length > 0 ? (
                                <TrophyChart data={data.charts.trophyHistory} />
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-gray-500">
                                    No historical data available yet
                                </div>
                            )}
                        </div>

                        {/* TH Distribution */}
                        <div className="glassmorphism rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Town Hall Distribution</h2>
                            {data.charts.thDistribution.length > 0 ? (
                                <THDistribution data={data.charts.thDistribution} />
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-gray-500">
                                    No data available
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Progressions */}
                    <div className="glassmorphism rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Top 10 Trophy Progressions (7 Days)
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Rank</th>
                                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Player</th>
                                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Current Trophies</th>
                                        <th className="text-left py-3 px-4 text-gray-400 font-medium">7d Change</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.topProgressions.map((player: any, index: number) => (
                                        <tr key={player.tag} className="border-b border-gray-800 hover:bg-gray-800/50">
                                            <td className="py-3 px-4 text-gray-300">#{index + 1}</td>
                                            <td className="py-3 px-4">
                                                <Link
                                                    href={`/player/${encodeURIComponent(player.tag)}`}
                                                    className="text-white hover:text-blue-400 transition-colors"
                                                >
                                                    {player.name}
                                                </Link>
                                            </td>
                                            <td className="py-3 px-4 text-gray-300">{player.currentTrophies.toLocaleString()}</td>
                                            <td className="py-3 px-4">
                                                <span
                                                    className={
                                                        player.delta > 0
                                                            ? 'text-green-400'
                                                            : player.delta < 0
                                                                ? 'text-red-400'
                                                                : 'text-gray-400'
                                                    }
                                                >
                                                    {player.delta > 0 ? '+' : ''}
                                                    {player.delta}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
