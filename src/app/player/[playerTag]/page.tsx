'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TrophyChart from '@/components/charts/TrophyChart'
import KPICard from '@/components/KPICard'
import { User, Trophy, TrendingUp, Award, Target } from 'lucide-react'
import Link from 'next/link'

export default function PlayerDetailPage() {
    const params = useParams()
    const playerTag = decodeURIComponent(params.playerTag as string)
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function fetchData() {
            try {
                const response = await fetch(`/api/player/${encodeURIComponent(playerTag)}`)
                if (!response.ok) throw new Error('Failed to fetch player data')
                const result = await response.json()
                setData(result)
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [playerTag])

    if (loading) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-white">Loading player data...</div>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-red-400">Error: {error || 'Player not found'}</div>
                </div>
            </div>
        )
    }

    const clanTag = data.player.clan?.tag

    return (
        <div className="flex min-h-screen bg-gray-900">
            {clanTag && <Sidebar clanTag={clanTag} />}

            <div className="flex-1 p-8 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-4">
                            {clanTag && (
                                <Link
                                    href={`/members/${encodeURIComponent(clanTag)}`}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    ← Back to Members
                                </Link>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">{data.player.name}</h1>
                        <p className="text-gray-400">{data.player.tag}</p>
                        {data.player.clan && (
                            <p className="text-gray-500 text-sm mt-1">
                                {data.player.clan.name} • {data.player.role}
                            </p>
                        )}
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <KPICard
                            title="IRJ Score"
                            value={data.irj.totalScore}
                            subtitle="Overall performance"
                            icon={Award}
                        />
                        <KPICard
                            title="Trophies"
                            value={data.stats.currentTrophies.toLocaleString()}
                            subtitle={`Best: ${data.stats.bestTrophies.toLocaleString()}`}
                            trend={{
                                value: data.stats.trophyDelta7d,
                                label: '7 days',
                            }}
                            icon={Trophy}
                        />
                        <KPICard
                            title="Town Hall"
                            value={`TH${data.player.townHallLevel}`}
                            subtitle={`Level ${data.player.expLevel}`}
                            icon={Target}
                        />
                        <KPICard
                            title="War Stars"
                            value={data.stats.warStars}
                            subtitle={`${data.stats.attackWins} attack wins`}
                            icon={Award}
                        />
                    </div>

                    {/* IRJ Breakdown */}
                    <div className="glassmorphism rounded-xl p-6 mb-8">
                        <h2 className="text-xl font-bold text-white mb-6">IRJ Score Breakdown</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400 text-sm">Presence</span>
                                    <span className="text-white font-semibold">{data.irj.components.presenceScore}/40</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className="bg-blue-500 h-2 rounded-full"
                                        style={{ width: `${(data.irj.components.presenceScore / 40) * 100}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400 text-sm">Trophy Progress</span>
                                    <span className="text-white font-semibold">{data.irj.components.trophyScore}/30</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className="bg-green-500 h-2 rounded-full"
                                        style={{ width: `${(data.irj.components.trophyScore / 30) * 100}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400 text-sm">Donations</span>
                                    <span className="text-white font-semibold">{data.irj.components.donationScore}/15</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className="bg-purple-500 h-2 rounded-full"
                                        style={{ width: `${(data.irj.components.donationScore / 15) * 100}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400 text-sm">War Participation</span>
                                    <span className="text-white font-semibold">{data.irj.components.warScore}/15</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className="bg-orange-500 h-2 rounded-full"
                                        style={{ width: `${(data.irj.components.warScore / 15) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Trophy History */}
                        <div className="glassmorphism rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Trophy History</h2>
                            {data.snapshots.length > 0 ? (
                                <TrophyChart
                                    data={data.snapshots
                                        .map((s: any) => ({
                                            timestamp: s.timestamp,
                                            trophies: s.trophies,
                                        }))
                                        .reverse()}
                                />
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-gray-500">
                                    No historical data available yet
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="glassmorphism rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Statistics</h2>
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Donations Sent</span>
                                    <span className="text-white font-semibold">{data.stats.donations.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Donations Received</span>
                                    <span className="text-white font-semibold">{data.stats.donationsReceived.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Attack Wins</span>
                                    <span className="text-white font-semibold">{data.stats.attackWins.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Defense Wins</span>
                                    <span className="text-white font-semibold">{data.stats.defenseWins.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Trophy Delta (7d)</span>
                                    <span
                                        className={
                                            data.stats.trophyDelta7d > 0
                                                ? 'text-green-400 font-semibold'
                                                : data.stats.trophyDelta7d < 0
                                                    ? 'text-red-400 font-semibold'
                                                    : 'text-white font-semibold'
                                        }
                                    >
                                        {data.stats.trophyDelta7d > 0 ? '+' : ''}
                                        {data.stats.trophyDelta7d}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Trophy Delta (30d)</span>
                                    <span
                                        className={
                                            data.stats.trophyDelta30d > 0
                                                ? 'text-green-400 font-semibold'
                                                : data.stats.trophyDelta30d < 0
                                                    ? 'text-red-400 font-semibold'
                                                    : 'text-white font-semibold'
                                        }
                                    >
                                        {data.stats.trophyDelta30d > 0 ? '+' : ''}
                                        {data.stats.trophyDelta30d}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
