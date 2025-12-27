'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Trophy, TrendingUp, TrendingDown, Award } from 'lucide-react'

export default function RankedPage() {
    const params = useParams()
    const clanTag = decodeURIComponent(params.clanTag as string)
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function fetchData() {
            try {
                const response = await fetch(`/api/clan/${encodeURIComponent(clanTag)}/ranked`)
                if (!response.ok) throw new Error('Failed to fetch ranked data')
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

    if (loading) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <Sidebar clanTag={clanTag} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-white">Chargement des données Ranked...</div>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <Sidebar clanTag={clanTag} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-red-400 mb-4">{error || 'Aucune donnée disponible'}</p>
                        <p className="text-gray-500 text-sm">Les données Ranked seront disponibles après la première collecte.</p>
                    </div>
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
                        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <Trophy className="w-8 h-8 text-yellow-400" />
                            Ranked Battles
                        </h1>
                        <p className="text-gray-400">
                            Semaine: <span className="text-white font-semibold">{data.weekId}</span>
                        </p>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                        <div className="glassmorphism rounded-xl p-6">
                            <p className="text-sm text-gray-400 mb-1">Joueurs classés</p>
                            <h3 className="text-3xl font-bold text-white">{data.stats.playersWithRanked}</h3>
                            <p className="text-xs text-gray-500 mt-1">sur {data.stats.totalPlayers} total</p>
                        </div>

                        <div className="glassmorphism rounded-xl p-6">
                            <p className="text-sm text-gray-400 mb-1">Promotions</p>
                            <h3 className="text-3xl font-bold text-green-400 flex items-center gap-2">
                                <TrendingUp className="w-6 h-6" />
                                {data.stats.promotions}
                            </h3>
                        </div>

                        <div className="glassmorphism rounded-xl p-6">
                            <p className="text-sm text-gray-400 mb-1">Rétrogradations</p>
                            <h3 className="text-3xl font-bold text-red-400 flex items-center gap-2">
                                <TrendingDown className="w-6 h-6" />
                                {data.stats.demotions}
                            </h3>
                        </div>

                        <div className="glassmorphism rounded-xl p-6">
                            <p className="text-sm text-gray-400 mb-1">Ligues différentes</p>
                            <h3 className="text-3xl font-bold text-purple-400">
                                {data.leagueDistribution.length}
                            </h3>
                        </div>

                        {/* Unranked Players Card */}
                        <div
                            className="glassmorphism rounded-xl p-6 cursor-pointer hover:bg-gray-700/50 transition-colors border-2 border-orange-500/30"
                            onClick={() => {
                                const section = document.getElementById('unranked-section')
                                if (section) {
                                    section.scrollIntoView({ behavior: 'smooth' })
                                }
                            }}
                        >
                            <p className="text-sm text-gray-400 mb-1">Non classés</p>
                            <h3 className="text-3xl font-bold text-orange-400">
                                {data.players.filter((p: any) => !p.league || p.league === 'Unranked' || String(p.league).includes('N/A')).length}
                            </h3>
                            <p className="text-xs text-orange-300 mt-1 underline">Voir les joueurs ↓</p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* League Distribution */}
                        <div className="glassmorphism rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Distribution des Ligues</h2>
                            {data.leagueDistribution.length > 0 ? (
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.leagueDistribution} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis type="number" stroke="#9CA3AF" />
                                            <YAxis dataKey="league" type="category" stroke="#9CA3AF" width={100} style={{ fontSize: '11px' }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                                                labelStyle={{ color: '#fff' }}
                                            />
                                            <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-gray-500">
                                    Aucune donnée de ligue disponible
                                </div>
                            )}
                        </div>

                        {/* Weekly Trophy History */}
                        <div className="glassmorphism rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Historique Hebdomadaire (Dimanche)</h2>
                            {data.weeklyHistory.length > 0 ? (
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={data.weeklyHistory}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis dataKey="weekId" stroke="#9CA3AF" style={{ fontSize: '11px' }} />
                                            <YAxis stroke="#9CA3AF" />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                                                labelStyle={{ color: '#fff' }}
                                            />
                                            <Line type="monotone" dataKey="avgTrophies" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-gray-500">
                                    Historique non disponible
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Players Table */}
                    <div className="glassmorphism rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">Classement Ranked</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-800/50">
                                    <tr>
                                        <th className="text-left py-4 px-6 text-gray-400 font-medium">Joueur</th>
                                        <th className="text-left py-4 px-6 text-gray-400 font-medium">Ligue</th>
                                        <th className="text-left py-4 px-6 text-gray-400 font-medium">Trophées</th>
                                        <th className="text-left py-4 px-6 text-gray-400 font-medium">Évolution</th>
                                        <th className="text-left py-4 px-6 text-gray-400 font-medium">Attaques</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.players.map((player: any) => (
                                        <tr key={player.tag} className="border-t border-gray-800 hover:bg-gray-800/50">
                                            <td className="py-4 px-6">
                                                <div className="text-white font-medium">{player.name}</div>
                                                <div className="text-xs text-gray-500">TH{player.townHall}</div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span
                                                    className="font-medium"
                                                    style={{ color: player.leagueColor || '#9CA3AF' }}
                                                >
                                                    {player.league || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-white">{player.trophies?.toLocaleString() || 'N/A'}</span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    {player.promoted && (
                                                        <span className="flex items-center gap-1 text-green-400 text-sm">
                                                            <TrendingUp className="w-4 h-4" /> Promu
                                                        </span>
                                                    )}
                                                    {player.demoted && (
                                                        <span className="flex items-center gap-1 text-red-400 text-sm">
                                                            <TrendingDown className="w-4 h-4" /> Rétrogradé
                                                        </span>
                                                    )}
                                                    {!player.promoted && !player.demoted && (
                                                        <span className="text-gray-400 text-sm">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-gray-300">{player.attacks || 0}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {data.players.length === 0 && (
                                <div className="py-12 text-center text-gray-500">
                                    Aucune donnée Ranked disponible. Attendez la prochaine collecte.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Unranked Players Section */}
                    {data.players.filter((p: any) => !p.league || p.league === 'Unranked' || p.league.includes('N/A')).length > 0 && (
                        <div id="unranked-section" className="glassmorphism rounded-xl overflow-hidden mt-8">
                            <div className="p-6 border-b border-gray-700 bg-orange-900/20">
                                <h2 className="text-xl font-bold text-orange-400">
                                    ⚠️ Joueurs Non Classés ({data.players.filter((p: any) => !p.league || p.league === 'Unranked' || p.league.includes('N/A')).length})
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    Ces joueurs n'ont pas encore de ligue Ranked assignée
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-800/50">
                                        <tr>
                                            <th className="text-left py-4 px-6 text-gray-400 font-medium">Joueur</th>
                                            <th className="text-left py-4 px-6 text-gray-400 font-medium">Town Hall</th>
                                            <th className="text-left py-4 px-6 text-gray-400 font-medium">Attaques</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.players
                                            .filter((p: any) => !p.league || p.league === 'Unranked' || p.league.includes('N/A'))
                                            .map((player: any) => (
                                                <tr key={player.tag} className="border-t border-gray-800 hover:bg-gray-800/50">
                                                    <td className="py-4 px-6">
                                                        <div className="text-white font-medium">{player.name}</div>
                                                        <div className="text-xs text-gray-500">{player.tag}</div>
                                                    </td>
                                                    <td className="py-4 px-6 text-gray-300">TH{player.townHall}</td>
                                                    <td className="py-4 px-6 text-gray-300">{player.attacks || 0}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
