'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import {
    Swords, Trophy, Target, TrendingUp, TrendingDown,
    Users, Clock, Crown, Shield, Zap, Award, Flame,
    ChevronDown, ChevronUp, Star, AlertTriangle, Calendar, Percent
} from 'lucide-react'

// Types for warlog aggregated data
interface WarlogData {
    summary: {
        totalWars: number
        wins: number
        losses: number
        ties: number
        winRate: number
        avgStars: number
        avgDestruction: number
        avgOpponentStars: number
        attackEfficiency: number
        perfectWars: number
        closeWars: number
        currentStreak: { count: number; type: 'win' | 'lose' | null }
    }
    recent: {
        totalWars: number
        wins: number
        losses: number
        winRate: number
    }
    teamSizeStats: Array<{ size: number; wins: number; losses: number; total: number; winRate: number }>
    monthlyStats: Array<{ month: string; wins: number; losses: number; ties: number; total: number }>
    wars: Array<{
        result: string
        endTime: string
        teamSize: number
        clan: { stars: number; destructionPercentage: number; attacks: number }
        opponent: { tag: string; name: string; badgeUrl?: string; clanLevel: number; stars: number; destructionPercentage: number }
    }>
}

// Types for individual player stats (built over time)
interface PlayerStats {
    tag: string
    name: string
    totalAttacks: number
    avgStars: number
    avgScore: number
    threeStarRate: number
    attackEfficiency: number
    warsParticipated: number
}

interface PlayerStatsData {
    totalWars: number
    totalAttacks: number
    playerStats: PlayerStats[]
    topPerformers: Array<{ tag: string; name: string; avgScore: number; avgStars: number; threeStarRate: number; totalAttacks: number }>
    needsImprovement: Array<{ tag: string; name: string; avgScore: number; avgStars: number; threeStarRate: number; missedAttacks: number }>
    clanAverages: { avgScore: number; avgStars: number; threeStarRate: number; avgAttackEfficiency: number } | null
}

// Types for current war
interface CurrentWarData {
    state: string
    teamSize: number
    timeRemaining: { hours: number; minutes: number; formatted: string }
    clan: { name: string; stars: number; destructionPercentage: number; attacks: number }
    opponent: { name: string; tag: string; badgeUrl?: string; stars: number; destructionPercentage: number; clanLevel: number }
    attackProgress: { used: number; max: number; percentage: number }
    summary: { notAttacked: number; partiallyAttacked: number; fullyAttacked: number }
    players: Array<{
        tag: string; name: string; townhallLevel: number; mapPosition: number
        usedAttacks: number; maxAttacks: number; totalStars: number
        attacks: Array<{ defenderName: string; defenderTH: number; defenderPos: number; stars: number; destructionPercentage: number; thDiff: number }>
    }>
    playersNotAttacked: Array<{ tag: string; name: string; th: number; pos: number }>
}

type TabType = 'current' | 'historical' | 'players'

export default function WarsPage() {
    const params = useParams()
    const clanTag = decodeURIComponent(params.clanTag as string)
    const [activeTab, setActiveTab] = useState<TabType>('historical')

    const [warlog, setWarlog] = useState<WarlogData | null>(null)
    const [playerStats, setPlayerStats] = useState<PlayerStatsData | null>(null)
    const [currentWar, setCurrentWar] = useState<CurrentWarData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
    const [sortBy, setSortBy] = useState<'score' | 'stars' | 'attacks' | 'efficiency'>('score')

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                // Fetch all APIs in parallel
                const [warlogRes, playerStatsRes, currentWarRes] = await Promise.all([
                    fetch(`/api/clan/${encodeURIComponent(clanTag)}/warlog`),
                    fetch(`/api/clan/${encodeURIComponent(clanTag)}/war-player-stats`),
                    fetch(`/api/clan/${encodeURIComponent(clanTag)}/current-war`),
                ])

                if (warlogRes.ok) {
                    setWarlog(await warlogRes.json())
                } else {
                    const errData = await warlogRes.json()
                    if (errData.code === 'PRIVATE_WAR_LOG') {
                        setError('Le log de guerre est privé')
                    }
                }

                if (playerStatsRes.ok) {
                    setPlayerStats(await playerStatsRes.json())
                }

                if (currentWarRes.ok) {
                    const data = await currentWarRes.json()
                    if (data.state && data.state !== 'notInWar') {
                        setCurrentWar(data)
                    }
                }
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [clanTag])

    const formatDate = (dateStr: string) => {
        if (!dateStr) return ''
        const year = parseInt(dateStr.substring(0, 4))
        const month = parseInt(dateStr.substring(4, 6)) - 1
        const day = parseInt(dateStr.substring(6, 8))
        return new Date(year, month, day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split('-')
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    }

    const getResultBg = (result: string | null) => {
        switch (result) {
            case 'win': return 'bg-green-500/20 border-green-500/30'
            case 'lose': return 'bg-red-500/20 border-red-500/30'
            case 'tie': return 'bg-yellow-500/20 border-yellow-500/30'
            default: return 'bg-gray-500/20 border-gray-500/30'
        }
    }

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400'
        if (score >= 60) return 'text-blue-400'
        if (score >= 40) return 'text-yellow-400'
        if (score >= 20) return 'text-orange-400'
        return 'text-red-400'
    }

    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-green-500/20'
        if (score >= 60) return 'bg-blue-500/20'
        if (score >= 40) return 'bg-yellow-500/20'
        if (score >= 20) return 'bg-orange-500/20'
        return 'bg-red-500/20'
    }

    const sortedPlayers = playerStats?.playerStats
        ? [...playerStats.playerStats].sort((a, b) => {
            switch (sortBy) {
                case 'stars': return b.avgStars - a.avgStars
                case 'attacks': return b.totalAttacks - a.totalAttacks
                case 'efficiency': return b.attackEfficiency - a.attackEfficiency
                default: return b.avgScore - a.avgScore
            }
        })
        : []

    if (loading) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <Sidebar clanTag={clanTag} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-white">Chargement des données de guerre...</div>
                </div>
            </div>
        )
    }

    if (error && !warlog) {
        return (
            <div className="flex min-h-screen bg-gray-900">
                <Sidebar clanTag={clanTag} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="glassmorphism rounded-xl p-8 text-center max-w-md">
                        <Shield className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Log de guerre privé</h2>
                        <p className="text-gray-400">{error}</p>
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
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <Swords className="w-8 h-8" />
                            Centre de Guerre
                        </h1>
                        <p className="text-gray-400">Analyse complète des performances en GdC</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-6">
                        {[
                            { id: 'current', label: 'Guerre en cours', icon: Clock, badge: currentWar ? '🔴' : null },
                            { id: 'historical', label: 'Historique', icon: Trophy },
                            { id: 'players', label: 'Joueurs', icon: Users, badge: playerStats?.totalAttacks ? `${playerStats.totalAttacks}` : null },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab.id
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                                {tab.badge && <span className="text-xs">{tab.badge}</span>}
                            </button>
                        ))}
                    </div>

                    {/* Current War Tab */}
                    {activeTab === 'current' && (
                        <>
                            {!currentWar ? (
                                <div className="glassmorphism rounded-xl p-12 text-center">
                                    <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-white mb-2">Pas de guerre en cours</h3>
                                    <p className="text-gray-400">Le clan n'est pas en guerre actuellement</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* War Header */}
                                    <div className="glassmorphism rounded-xl p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-6">
                                                <div className="text-center">
                                                    <p className="text-sm text-gray-400">Notre clan</p>
                                                    <p className="text-4xl font-bold text-white">{currentWar.clan.stars}⭐</p>
                                                    <p className="text-sm text-gray-400">{currentWar.clan.destructionPercentage.toFixed(1)}%</p>
                                                </div>
                                                <div className="text-4xl text-gray-500">VS</div>
                                                <div className="text-center">
                                                    <p className="text-sm text-gray-400">{currentWar.opponent.name}</p>
                                                    <p className="text-4xl font-bold text-white">{currentWar.opponent.stars}⭐</p>
                                                    <p className="text-sm text-gray-400">{currentWar.opponent.destructionPercentage.toFixed(1)}%</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-400">Temps restant</p>
                                                <p className={`text-3xl font-bold ${currentWar.timeRemaining.hours < 2 ? 'text-red-400' : 'text-green-400'}`}>
                                                    {currentWar.timeRemaining.formatted}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="pt-4 border-t border-gray-700">
                                            <div className="flex justify-between text-sm text-gray-400 mb-2">
                                                <span>Attaques</span>
                                                <span>{currentWar.attackProgress.used}/{currentWar.attackProgress.max} ({currentWar.attackProgress.percentage}%)</span>
                                            </div>
                                            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${currentWar.attackProgress.percentage}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Missing attacks alert */}
                                    {currentWar.playersNotAttacked.length > 0 && (
                                        <div className="glassmorphism rounded-xl p-4 border border-red-500/30 bg-red-900/10">
                                            <div className="flex items-center gap-3 mb-3">
                                                <AlertTriangle className="w-5 h-5 text-red-400" />
                                                <span className="font-semibold text-red-400">{currentWar.playersNotAttacked.length} joueur(s) n'ont pas attaqué</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {currentWar.playersNotAttacked.map(p => (
                                                    <span key={p.tag} className="px-3 py-1 bg-red-500/20 rounded-lg text-sm text-red-300">
                                                        #{p.pos} {p.name} (TH{p.th})
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Player attacks */}
                                    <div className="glassmorphism rounded-xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4">Attaques des joueurs</h3>
                                        <div className="space-y-2">
                                            {currentWar.players.map(player => (
                                                <div key={player.tag} className="bg-gray-800/50 rounded-lg overflow-hidden">
                                                    <button
                                                        onClick={() => setExpandedPlayer(expandedPlayer === player.tag ? null : player.tag)}
                                                        className="w-full p-4 flex items-center justify-between hover:bg-gray-700/50"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-gray-500 w-8">#{player.mapPosition}</span>
                                                            <span className="font-medium text-white">{player.name}</span>
                                                            <span className="text-xs px-2 py-1 bg-gray-700 rounded">TH{player.townhallLevel}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex gap-1">
                                                                {Array.from({ length: player.maxAttacks }).map((_, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className={`w-6 h-6 rounded flex items-center justify-center text-xs ${i < player.usedAttacks
                                                                                ? player.attacks[i]?.stars === 3 ? 'bg-yellow-500 text-black'
                                                                                    : player.attacks[i]?.stars === 2 ? 'bg-purple-500 text-white'
                                                                                        : 'bg-gray-500 text-white'
                                                                                : 'bg-gray-700 text-gray-500'
                                                                            }`}
                                                                    >
                                                                        {i < player.usedAttacks ? player.attacks[i]?.stars : '-'}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {expandedPlayer === player.tag ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                                        </div>
                                                    </button>
                                                    {expandedPlayer === player.tag && player.attacks.length > 0 && (
                                                        <div className="px-4 pb-4 space-y-2">
                                                            {player.attacks.map((atk, i) => (
                                                                <div key={i} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-gray-500">→</span>
                                                                        <span className="text-white">#{atk.defenderPos} {atk.defenderName}</span>
                                                                        <span className={`text-xs px-2 py-0.5 rounded ${atk.thDiff > 0 ? 'bg-green-500/20 text-green-400' : atk.thDiff < 0 ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300'}`}>
                                                                            TH{atk.defenderTH} ({atk.thDiff > 0 ? '+' : ''}{atk.thDiff})
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-gray-400">{atk.destructionPercentage}%</span>
                                                                        <span className={`font-bold ${atk.stars === 3 ? 'text-yellow-400' : atk.stars === 2 ? 'text-purple-400' : 'text-gray-400'}`}>
                                                                            {'⭐'.repeat(atk.stars)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Historical Tab - Uses WARLOG data */}
                    {activeTab === 'historical' && warlog && (
                        <div className="space-y-6">
                            {/* Main KPIs */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <div className="glassmorphism rounded-xl p-5">
                                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                                        <Swords className="w-4 h-4" />
                                        <span className="text-xs">Guerres</span>
                                    </div>
                                    <p className="text-3xl font-bold text-white">{warlog.summary.totalWars}</p>
                                </div>
                                <div className="glassmorphism rounded-xl p-5">
                                    <div className="flex items-center gap-2 text-green-400 mb-2">
                                        <Trophy className="w-4 h-4" />
                                        <span className="text-xs">Victoires</span>
                                    </div>
                                    <p className="text-3xl font-bold text-green-400">{warlog.summary.wins}</p>
                                    <p className="text-xs text-gray-500">{warlog.summary.winRate}% win rate</p>
                                </div>
                                <div className="glassmorphism rounded-xl p-5">
                                    <div className="flex items-center gap-2 text-red-400 mb-2">
                                        <TrendingDown className="w-4 h-4" />
                                        <span className="text-xs">Défaites</span>
                                    </div>
                                    <p className="text-3xl font-bold text-red-400">{warlog.summary.losses}</p>
                                </div>
                                <div className="glassmorphism rounded-xl p-5">
                                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                                        <Star className="w-4 h-4" />
                                        <span className="text-xs">Étoiles moy.</span>
                                    </div>
                                    <p className="text-3xl font-bold text-yellow-400">{warlog.summary.avgStars}</p>
                                </div>
                                <div className="glassmorphism rounded-xl p-5">
                                    <div className="flex items-center gap-2 text-orange-400 mb-2">
                                        <Flame className="w-4 h-4" />
                                        <span className="text-xs">Destruction moy.</span>
                                    </div>
                                    <p className="text-3xl font-bold text-orange-400">{warlog.summary.avgDestruction}%</p>
                                </div>
                                <div className="glassmorphism rounded-xl p-5">
                                    <div className="flex items-center gap-2 text-purple-400 mb-2">
                                        <Zap className="w-4 h-4" />
                                        <span className="text-xs">Attaques utilisées</span>
                                    </div>
                                    <p className="text-3xl font-bold text-purple-400">{warlog.summary.attackEfficiency}%</p>
                                </div>
                            </div>

                            {/* Streak + Perfect + Recent */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className={`glassmorphism rounded-xl p-6 ${warlog.summary.currentStreak.type === 'win' ? 'border border-green-500/30' : warlog.summary.currentStreak.type === 'lose' ? 'border border-red-500/30' : ''}`}>
                                    <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                                        {warlog.summary.currentStreak.type === 'win' ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                                        Série en cours
                                    </h3>
                                    <div className="flex items-end gap-2">
                                        <span className={`text-5xl font-bold ${warlog.summary.currentStreak.type === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                                            {warlog.summary.currentStreak.count}
                                        </span>
                                        <span className="text-gray-400 mb-2">{warlog.summary.currentStreak.type === 'win' ? 'victoire(s)' : 'défaite(s)'}</span>
                                    </div>
                                </div>
                                <div className="glassmorphism rounded-xl p-6">
                                    <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                                        <Award className="w-4 h-4 text-yellow-400" />
                                        Guerres parfaites
                                    </h3>
                                    <div className="flex items-end gap-2">
                                        <span className="text-5xl font-bold text-yellow-400">{warlog.summary.perfectWars}</span>
                                        <span className="text-gray-400 mb-2">100% destruction</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">{warlog.summary.closeWars} guerres serrées</p>
                                </div>
                                <div className="glassmorphism rounded-xl p-6">
                                    <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        30 derniers jours
                                    </h3>
                                    <div className="flex items-end gap-4">
                                        <div>
                                            <span className="text-4xl font-bold text-white">{warlog.recent.totalWars}</span>
                                            <span className="text-gray-400 ml-2">guerres</span>
                                        </div>
                                        <div className={`px-3 py-1 rounded-lg ${warlog.recent.winRate >= 50 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {warlog.recent.winRate}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Monthly Performance */}
                                <div className="glassmorphism rounded-xl p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <Calendar className="w-5 h-5" />
                                        Performance mensuelle
                                    </h3>
                                    <div className="space-y-3">
                                        {warlog.monthlyStats.map((month) => {
                                            const total = month.wins + month.losses + month.ties
                                            const winPct = total > 0 ? (month.wins / total) * 100 : 0
                                            const losePct = total > 0 ? (month.losses / total) * 100 : 0
                                            return (
                                                <div key={month.month} className="space-y-1">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-400">{formatMonth(month.month)}</span>
                                                        <span className="text-gray-400">
                                                            <span className="text-green-400">{month.wins}</span>/<span className="text-red-400">{month.losses}</span>
                                                            {month.ties > 0 && <span className="text-yellow-400">/{month.ties}</span>}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
                                                        <div className="h-full bg-green-500" style={{ width: `${winPct}%` }} />
                                                        <div className="h-full bg-red-500" style={{ width: `${losePct}%` }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Team Size Stats */}
                                <div className="glassmorphism rounded-xl p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <Users className="w-5 h-5" />
                                        Par taille de guerre
                                    </h3>
                                    <div className="space-y-3">
                                        {warlog.teamSizeStats.slice(0, 5).map((ts) => (
                                            <div key={ts.size} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl font-bold text-white">{ts.size}v{ts.size}</span>
                                                    <span className="text-sm text-gray-500">{ts.total} guerres</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right text-sm">
                                                        <span className="text-green-400">{ts.wins}W</span>/<span className="text-red-400">{ts.losses}L</span>
                                                    </div>
                                                    <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${ts.winRate >= 60 ? 'bg-green-500/20 text-green-400' : ts.winRate >= 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {ts.winRate}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Wars List */}
                            <div className="glassmorphism rounded-xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Swords className="w-5 h-5" />
                                    Guerres récentes
                                </h3>
                                <div className="space-y-3">
                                    {warlog.wars.slice(0, 10).map((war, i) => (
                                        <div key={i} className={`p-4 rounded-xl border ${getResultBg(war.result)} transition-all hover:scale-[1.01]`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    {war.opponent.badgeUrl && <img src={war.opponent.badgeUrl} alt="" className="w-10 h-10 rounded" />}
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-white">vs {war.opponent.name}</span>
                                                            <span className={`text-xs font-semibold uppercase ${war.result === 'win' ? 'text-green-400' : war.result === 'lose' ? 'text-red-400' : 'text-yellow-400'}`}>
                                                                {war.result === 'win' ? 'VICTOIRE' : war.result === 'lose' ? 'DÉFAITE' : 'NUL'}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-400">{war.teamSize}v{war.teamSize} • Niv. {war.opponent.clanLevel} • {formatDate(war.endTime)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6 text-sm">
                                                    <div className="text-center">
                                                        <div className="text-xs text-gray-500">Nous</div>
                                                        <div className="font-bold text-white">{war.clan.stars}⭐ {war.clan.destructionPercentage.toFixed(0)}%</div>
                                                    </div>
                                                    <div className="text-gray-500">vs</div>
                                                    <div className="text-center">
                                                        <div className="text-xs text-gray-500">Eux</div>
                                                        <div className="font-bold text-white">{war.opponent.stars}⭐ {war.opponent.destructionPercentage?.toFixed(0) || 0}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Players Tab - Individual stats (built over time) */}
                    {activeTab === 'players' && (
                        <div className="space-y-6">
                            {/* Info banner about progressive data */}
                            <div className="glassmorphism rounded-xl p-4 border border-blue-500/30 bg-blue-900/10">
                                <div className="flex items-start gap-3">
                                    <Zap className="w-5 h-5 text-blue-400 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-blue-400">Données progressives</p>
                                        <p className="text-sm text-gray-400">
                                            Ces stats individuelles sont collectées lors de chaque synchronisation pendant une guerre.
                                            L'historique s'enrichit au fil du temps.
                                            {playerStats?.totalWars ? ` ${playerStats.totalWars} guerre(s) analysée(s).` : ''}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {playerStats && playerStats.totalAttacks > 0 ? (
                                <>
                                    {/* Clan averages KPIs */}
                                    {playerStats.clanAverages && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="glassmorphism rounded-xl p-5">
                                                <div className="flex items-center gap-2 text-gray-400 mb-2">
                                                    <Swords className="w-4 h-4" />
                                                    <span className="text-xs">Guerres analysées</span>
                                                </div>
                                                <p className="text-3xl font-bold text-white">{playerStats.totalWars}</p>
                                            </div>
                                            <div className="glassmorphism rounded-xl p-5">
                                                <div className="flex items-center gap-2 text-blue-400 mb-2">
                                                    <Target className="w-4 h-4" />
                                                    <span className="text-xs">Score SPA moyen</span>
                                                </div>
                                                <p className="text-3xl font-bold text-blue-400">{playerStats.clanAverages.avgScore}</p>
                                            </div>
                                            <div className="glassmorphism rounded-xl p-5">
                                                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                                                    <Star className="w-4 h-4" />
                                                    <span className="text-xs">Étoiles moyennes</span>
                                                </div>
                                                <p className="text-3xl font-bold text-yellow-400">{playerStats.clanAverages.avgStars}</p>
                                            </div>
                                            <div className="glassmorphism rounded-xl p-5">
                                                <div className="flex items-center gap-2 text-green-400 mb-2">
                                                    <Percent className="w-4 h-4" />
                                                    <span className="text-xs">Taux 3 étoiles</span>
                                                </div>
                                                <p className="text-3xl font-bold text-green-400">{playerStats.clanAverages.threeStarRate}%</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Top Performers & Needs Help */}
                                    {(playerStats.topPerformers?.length > 0 || playerStats.needsImprovement?.length > 0) && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="glassmorphism rounded-xl p-6">
                                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                                    <Crown className="w-5 h-5 text-yellow-400" />
                                                    Top Performers
                                                </h3>
                                                <div className="space-y-3">
                                                    {playerStats.topPerformers.map((p, i) => (
                                                        <div key={p.tag} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`text-lg font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-500'}`}>#{i + 1}</span>
                                                                <span className="font-medium text-white">{p.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-sm">
                                                                <span className={`font-bold ${getScoreColor(p.avgScore)}`}>{p.avgScore}</span>
                                                                <span className="text-yellow-400">{p.threeStarRate}% ⭐⭐⭐</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="glassmorphism rounded-xl p-6">
                                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                                    <TrendingDown className="w-5 h-5 text-red-400" />
                                                    À accompagner
                                                </h3>
                                                <div className="space-y-3">
                                                    {playerStats.needsImprovement.map((p) => (
                                                        <div key={p.tag} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                                                            <span className="font-medium text-white">{p.name}</span>
                                                            <div className="flex items-center gap-4 text-sm">
                                                                <span className={`font-bold ${getScoreColor(p.avgScore)}`}>{p.avgScore}</span>
                                                                {p.missedAttacks > 0 && <span className="text-red-400">{p.missedAttacks} manquées</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Full Player Table */}
                                    <div className="glassmorphism rounded-xl p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-white">Classement complet</h3>
                                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm">
                                                <option value="score">Trier par Score</option>
                                                <option value="stars">Trier par Étoiles</option>
                                                <option value="attacks">Trier par Attaques</option>
                                                <option value="efficiency">Trier par Efficacité</option>
                                            </select>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-gray-400 border-b border-gray-700">
                                                        <th className="p-3">#</th>
                                                        <th className="p-3">Joueur</th>
                                                        <th className="p-3 text-center">Attaques</th>
                                                        <th className="p-3 text-center">Étoiles moy.</th>
                                                        <th className="p-3 text-center">Score SPA</th>
                                                        <th className="p-3 text-center">3⭐</th>
                                                        <th className="p-3 text-center">Efficacité</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedPlayers.map((p, i) => (
                                                        <tr key={p.tag} className="border-b border-gray-800 hover:bg-gray-800/50">
                                                            <td className="p-3 text-gray-500">{i + 1}</td>
                                                            <td className="p-3 font-medium text-white">{p.name}</td>
                                                            <td className="p-3 text-center text-gray-300">{p.totalAttacks}</td>
                                                            <td className="p-3 text-center text-yellow-400">{p.avgStars.toFixed(2)}</td>
                                                            <td className="p-3 text-center">
                                                                <span className={`px-2 py-1 rounded ${getScoreBg(p.avgScore)} ${getScoreColor(p.avgScore)}`}>{p.avgScore}</span>
                                                            </td>
                                                            <td className="p-3 text-center text-green-400">{p.threeStarRate}%</td>
                                                            <td className="p-3 text-center">
                                                                <span className={p.attackEfficiency < 80 ? 'text-red-400' : 'text-green-400'}>{p.attackEfficiency}%</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="glassmorphism rounded-xl p-12 text-center">
                                    <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-white mb-2">Pas encore de données individuelles</h3>
                                    <p className="text-gray-400 max-w-md mx-auto">
                                        Les données seront collectées automatiquement lors de la prochaine synchronisation
                                        <strong className="text-white"> pendant ou après une guerre</strong>.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
