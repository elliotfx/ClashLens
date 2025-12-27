'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import { Swords, TrendingUp, TrendingDown, Target, Users, Award, AlertCircle, ChevronUp, ChevronDown, Minus } from 'lucide-react'
import Link from 'next/link'

interface PlayerStats {
    tag: string
    name: string
    totalAttacks: number
    avgScore: number
    avgStars: number
    climb: { count: number; avgScore: number }
    level: { count: number; avgScore: number }
    dip: { count: number; avgScore: number }
}

interface WarStats {
    clan: { tag: string; name: string }
    totalWars: number
    totalAttacks: number
    avgScore: number
    categoryStats: {
        climb: { count: number; avgScore: number; avgStars: number }
        level: { count: number; avgScore: number; avgStars: number }
        dip: { count: number; avgScore: number; avgStars: number }
    }
    topClimbers: PlayerStats[]
    needsHelp: PlayerStats[]
    playerStats: PlayerStats[]
}

export default function WarAnalysisPage() {
    const params = useParams()
    const clanTag = decodeURIComponent(params.clanTag as string)
    const [data, setData] = useState<WarStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function fetchData() {
            try {
                const response = await fetch(`/api/clan/${encodeURIComponent(clanTag)}/war-stats`)
                if (!response.ok) throw new Error('Failed to fetch war stats')
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

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400'
        if (score >= 60) return 'text-blue-400'
        if (score >= 40) return 'text-yellow-400'
        if (score >= 20) return 'text-orange-400'
        return 'text-red-400'
    }

    const getScoreBadge = (score: number) => {
        if (score >= 80) return { label: 'Excellent', color: 'bg-green-500/20 text-green-400' }
        if (score >= 60) return { label: 'Bon', color: 'bg-blue-500/20 text-blue-400' }
        if (score >= 40) return { label: 'Moyen', color: 'bg-yellow-500/20 text-yellow-400' }
        return { label: 'À améliorer', color: 'bg-red-500/20 text-red-400' }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <Sidebar clanTag={clanTag} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-white">Chargement de l'analyse...</div>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <Sidebar clanTag={clanTag} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-red-400">Erreur: {error || 'Données non disponibles'}</div>
                </div>
            </div>
        )
    }

    const totalCategoryAttacks = data.categoryStats.climb.count + data.categoryStats.level.count + data.categoryStats.dip.count

    return (
        <div className="flex min-h-screen bg-gray-900">
            <Sidebar clanTag={clanTag} />

            <div className="flex-1 p-8 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <Swords className="w-8 h-8" />
                            Analyse des Attaques en GdC
                        </h1>
                        <p className="text-gray-400">Performance détaillée des attaques basée sur le différentiel HDV</p>
                    </div>

                    {/* No data message */}
                    {data.totalAttacks === 0 ? (
                        <div className="glassmorphism rounded-xl p-8 text-center">
                            <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">Aucune donnée d'attaque</h2>
                            <p className="text-gray-400">
                                Les attaques seront analysées lors de la prochaine collecte de données de guerre.
                                <br />Vérifiez que le log de guerre est public.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Overview KPIs */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                <div className="glassmorphism rounded-xl p-6">
                                    <p className="text-sm text-gray-400 mb-1">Guerres analysées</p>
                                    <p className="text-3xl font-bold text-white">{data.totalWars}</p>
                                </div>
                                <div className="glassmorphism rounded-xl p-6">
                                    <p className="text-sm text-gray-400 mb-1">Attaques totales</p>
                                    <p className="text-3xl font-bold text-white">{data.totalAttacks}</p>
                                </div>
                                <div className="glassmorphism rounded-xl p-6">
                                    <p className="text-sm text-gray-400 mb-1">Score moyen clan</p>
                                    <p className={`text-3xl font-bold ${getScoreColor(data.avgScore)}`}>
                                        {data.avgScore}
                                    </p>
                                </div>
                                <div className="glassmorphism rounded-xl p-6">
                                    <p className="text-sm text-gray-400 mb-1">Évaluation globale</p>
                                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getScoreBadge(data.avgScore).color}`}>
                                        {getScoreBadge(data.avgScore).label}
                                    </span>
                                </div>
                            </div>

                            {/* Category Breakdown */}
                            <div className="glassmorphism rounded-xl p-6 mb-8">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Target className="w-5 h-5" />
                                    Répartition par type d'attaque
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ChevronUp className="w-5 h-5 text-green-400" />
                                            <span className="text-green-400 font-semibold">Montée</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white">{data.categoryStats.climb.count}</p>
                                        <p className="text-sm text-gray-400">
                                            Score moy: <span className={getScoreColor(data.categoryStats.climb.avgScore)}>
                                                {data.categoryStats.climb.avgScore}
                                            </span>
                                        </p>
                                        {totalCategoryAttacks > 0 && (
                                            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500"
                                                    style={{ width: `${(data.categoryStats.climb.count / totalCategoryAttacks) * 100}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Minus className="w-5 h-5 text-yellow-400" />
                                            <span className="text-yellow-400 font-semibold">Niveau</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white">{data.categoryStats.level.count}</p>
                                        <p className="text-sm text-gray-400">
                                            Score moy: <span className={getScoreColor(data.categoryStats.level.avgScore)}>
                                                {data.categoryStats.level.avgScore}
                                            </span>
                                        </p>
                                        {totalCategoryAttacks > 0 && (
                                            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-yellow-500"
                                                    style={{ width: `${(data.categoryStats.level.count / totalCategoryAttacks) * 100}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ChevronDown className="w-5 h-5 text-red-400" />
                                            <span className="text-red-400 font-semibold">Descente</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white">{data.categoryStats.dip.count}</p>
                                        <p className="text-sm text-gray-400">
                                            Score moy: <span className={getScoreColor(data.categoryStats.dip.avgScore)}>
                                                {data.categoryStats.dip.avgScore}
                                            </span>
                                        </p>
                                        {totalCategoryAttacks > 0 && (
                                            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-red-500"
                                                    style={{ width: `${(data.categoryStats.dip.count / totalCategoryAttacks) * 100}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Top Climbers & Needs Help Side by Side */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                {/* Top Climbers */}
                                <div className="glassmorphism rounded-xl p-6">
                                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-green-400" />
                                        Top Attaquants en Montée
                                    </h2>
                                    {data.topClimbers.length > 0 ? (
                                        <div className="space-y-3">
                                            {data.topClimbers.map((player, i) => (
                                                <div key={player.tag} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg font-bold text-gray-500">#{i + 1}</span>
                                                        <div>
                                                            <p className="text-white font-medium">{player.name}</p>
                                                            <p className="text-xs text-gray-500">{player.climb.count} attaques</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-xl font-bold ${getScoreColor(player.climb.avgScore)}`}>
                                                        {player.climb.avgScore}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">Pas assez de données</p>
                                    )}
                                </div>

                                {/* Needs Help */}
                                <div className="glassmorphism rounded-xl p-6">
                                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5 text-orange-400" />
                                        Joueurs à Accompagner
                                    </h2>
                                    {data.needsHelp.length > 0 ? (
                                        <div className="space-y-3">
                                            {data.needsHelp.map((player, i) => (
                                                <div key={player.tag} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg font-bold text-gray-500">#{i + 1}</span>
                                                        <div>
                                                            <p className="text-white font-medium">{player.name}</p>
                                                            <p className="text-xs text-gray-500">{player.dip.count} descentes</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-xl font-bold ${getScoreColor(player.dip.avgScore)}`}>
                                                        {player.dip.avgScore}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">Aucun joueur en difficulté 🎉</p>
                                    )}
                                </div>
                            </div>

                            {/* Full Player Ranking */}
                            <div className="glassmorphism rounded-xl p-6">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    Classement des Attaquants
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                                                <th className="pb-3 pr-4">#</th>
                                                <th className="pb-3 pr-4">Joueur</th>
                                                <th className="pb-3 pr-4 text-center">Attaques</th>
                                                <th className="pb-3 pr-4 text-center">Score Moy.</th>
                                                <th className="pb-3 pr-4 text-center">⭐ Moy.</th>
                                                <th className="pb-3 pr-4 text-center">
                                                    <span className="text-green-400">Montée</span>
                                                </th>
                                                <th className="pb-3 pr-4 text-center">
                                                    <span className="text-yellow-400">Niveau</span>
                                                </th>
                                                <th className="pb-3 text-center">
                                                    <span className="text-red-400">Descente</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.playerStats.map((player, i) => (
                                                <tr key={player.tag} className="border-b border-gray-800 hover:bg-gray-800/30">
                                                    <td className="py-3 pr-4 text-gray-500">{i + 1}</td>
                                                    <td className="py-3 pr-4">
                                                        <span className="text-white font-medium">{player.name}</span>
                                                    </td>
                                                    <td className="py-3 pr-4 text-center text-gray-400">{player.totalAttacks}</td>
                                                    <td className="py-3 pr-4 text-center">
                                                        <span className={`font-bold ${getScoreColor(player.avgScore)}`}>
                                                            {player.avgScore}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 pr-4 text-center text-yellow-400">{player.avgStars}</td>
                                                    <td className="py-3 pr-4 text-center">
                                                        {player.climb.count > 0 ? (
                                                            <span className={getScoreColor(player.climb.avgScore)}>
                                                                {player.climb.avgScore} ({player.climb.count})
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 pr-4 text-center">
                                                        {player.level.count > 0 ? (
                                                            <span className={getScoreColor(player.level.avgScore)}>
                                                                {player.level.avgScore} ({player.level.count})
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        {player.dip.count > 0 ? (
                                                            <span className={getScoreColor(player.dip.avgScore)}>
                                                                {player.dip.avgScore} ({player.dip.count})
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
