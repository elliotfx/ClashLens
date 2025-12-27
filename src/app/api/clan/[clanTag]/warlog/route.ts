import { NextRequest, NextResponse } from 'next/server'
import { cocClient } from '@/lib/coc/client'

interface WarLogEntry {
    result: 'win' | 'lose' | 'tie' | null
    endTime: string
    teamSize: number
    attacksPerMember: number
    battleModifier: string
    clan: {
        tag: string
        name: string
        badgeUrls: { small: string; medium: string; large: string }
        clanLevel: number
        attacks: number
        stars: number
        destructionPercentage: number
        expEarned: number
    }
    opponent: {
        tag?: string
        name?: string
        badgeUrls: { small: string; medium: string; large: string }
        clanLevel: number
        stars: number
        destructionPercentage: number
    }
}

interface WarLogResponse {
    items: WarLogEntry[]
}

export async function GET(
    request: NextRequest,
    { params }: { params: { clanTag: string } }
) {
    try {
        const clanTag = params.clanTag

        // Fetch war log from CoC API
        const warLogData = await cocClient.getWarLog(clanTag)

        const wars = (warLogData.items || []) as WarLogEntry[]

        // Filter out CWL entries (they have null result and weird stats)
        const regularWars = wars.filter(w =>
            w.attacksPerMember === 2 && w.result !== null
        )

        // Calculate aggregated stats
        const totalWars = regularWars.length
        const wins = regularWars.filter(w => w.result === 'win').length
        const losses = regularWars.filter(w => w.result === 'lose').length
        const ties = regularWars.filter(w => w.result === 'tie').length
        const winRate = totalWars > 0 ? Math.round((wins / totalWars) * 100) : 0

        // Get recent wars (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const recentWars = regularWars.filter(w => {
            const endDate = parseCoCADate(w.endTime)
            return endDate >= thirtyDaysAgo
        })

        const recentWins = recentWars.filter(w => w.result === 'win').length
        const recentLosses = recentWars.filter(w => w.result === 'lose').length
        const recentWinRate = recentWars.length > 0
            ? Math.round((recentWins / recentWars.length) * 100)
            : 0

        // Calculate average stats
        const avgStars = totalWars > 0
            ? Math.round(regularWars.reduce((sum, w) => sum + (w.clan.stars || 0), 0) / totalWars * 10) / 10
            : 0
        const avgDestruction = totalWars > 0
            ? Math.round(regularWars.reduce((sum, w) => sum + (w.clan.destructionPercentage || 0), 0) / totalWars * 10) / 10
            : 0
        const avgOpponentStars = totalWars > 0
            ? Math.round(regularWars.reduce((sum, w) => sum + (w.opponent.stars || 0), 0) / totalWars * 10) / 10
            : 0

        // Attack efficiency (attacks used vs max possible)
        const totalAttacks = regularWars.reduce((sum, w) => sum + (w.clan.attacks || 0), 0)
        const maxPossibleAttacks = regularWars.reduce((sum, w) => sum + (w.teamSize * 2), 0)
        const attackEfficiency = maxPossibleAttacks > 0
            ? Math.round((totalAttacks / maxPossibleAttacks) * 100)
            : 0

        // Win streak calculation
        let currentStreak = 0
        let streakType: 'win' | 'lose' | null = null
        for (const war of regularWars) {
            if (!streakType) {
                streakType = war.result as 'win' | 'lose'
                currentStreak = 1
            } else if (war.result === streakType) {
                currentStreak++
            } else {
                break
            }
        }

        // Perfect wars (100% destruction)
        const perfectWars = regularWars.filter(w =>
            w.clan.destructionPercentage >= 100 && w.result === 'win'
        ).length

        // Close wars (star difference <= 2)
        const closeWars = regularWars.filter(w => {
            const diff = Math.abs((w.clan.stars || 0) - (w.opponent.stars || 0))
            return diff <= 2 && w.result !== null
        }).length

        // Team size distribution
        const teamSizeStats: { [key: number]: { wins: number; losses: number; total: number } } = {}
        regularWars.forEach(w => {
            if (!teamSizeStats[w.teamSize]) {
                teamSizeStats[w.teamSize] = { wins: 0, losses: 0, total: 0 }
            }
            teamSizeStats[w.teamSize].total++
            if (w.result === 'win') teamSizeStats[w.teamSize].wins++
            if (w.result === 'lose') teamSizeStats[w.teamSize].losses++
        })

        // Monthly breakdown (last 6 months)
        const monthlyStats: { [key: string]: { wins: number; losses: number; ties: number } } = {}
        regularWars.forEach(w => {
            const date = parseCoCADate(w.endTime)
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = { wins: 0, losses: 0, ties: 0 }
            }
            if (w.result === 'win') monthlyStats[monthKey].wins++
            else if (w.result === 'lose') monthlyStats[monthKey].losses++
            else if (w.result === 'tie') monthlyStats[monthKey].ties++
        })

        // Sort monthly stats by date
        const sortedMonths = Object.entries(monthlyStats)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 6)
            .reverse()

        return NextResponse.json({
            summary: {
                totalWars,
                wins,
                losses,
                ties,
                winRate,
                avgStars,
                avgDestruction,
                avgOpponentStars,
                attackEfficiency,
                perfectWars,
                closeWars,
                currentStreak: {
                    count: currentStreak,
                    type: streakType,
                },
            },
            recent: {
                totalWars: recentWars.length,
                wins: recentWins,
                losses: recentLosses,
                winRate: recentWinRate,
            },
            teamSizeStats: Object.entries(teamSizeStats)
                .map(([size, stats]) => ({
                    size: parseInt(size),
                    ...stats,
                    winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
                }))
                .sort((a, b) => b.total - a.total),
            monthlyStats: sortedMonths.map(([month, stats]) => ({
                month,
                ...stats,
                total: stats.wins + stats.losses + stats.ties,
            })),
            wars: regularWars.slice(0, 20).map(w => ({
                result: w.result,
                endTime: w.endTime,
                teamSize: w.teamSize,
                clan: {
                    stars: w.clan.stars,
                    destructionPercentage: w.clan.destructionPercentage,
                    attacks: w.clan.attacks,
                },
                opponent: {
                    tag: w.opponent.tag,
                    name: w.opponent.name,
                    badgeUrl: w.opponent.badgeUrls?.small,
                    clanLevel: w.opponent.clanLevel,
                    stars: w.opponent.stars,
                    destructionPercentage: w.opponent.destructionPercentage,
                },
            })),
        })
    } catch (error: any) {
        console.error('[API] War log error:', error)

        // Check if it's a CoCAPIError with specific reason
        if (error.reason === 'accessDenied') {
            // This is the "war log is private" case
            return NextResponse.json(
                { error: 'War log is private', code: 'PRIVATE_WAR_LOG' },
                { status: 403 }
            )
        }

        if (error.reason === 'accessDenied.invalidIp') {
            return NextResponse.json(
                { error: 'API IP not authorized. Please check your CoC API key settings.', code: 'INVALID_IP' },
                { status: 403 }
            )
        }

        // For other errors, include the message
        return NextResponse.json(
            { error: error.message || 'Failed to fetch war log', reason: error.reason },
            { status: 500 }
        )
    }
}

// Parse CoC API date format (e.g., "20251224T065115.000Z")
function parseCoCADate(dateStr: string): Date {
    if (!dateStr) return new Date()
    // Format: YYYYMMDDTHHmmss.SSSZ
    const year = parseInt(dateStr.substring(0, 4))
    const month = parseInt(dateStr.substring(4, 6)) - 1
    const day = parseInt(dateStr.substring(6, 8))
    const hour = parseInt(dateStr.substring(9, 11))
    const minute = parseInt(dateStr.substring(11, 13))
    const second = parseInt(dateStr.substring(13, 15))
    return new Date(Date.UTC(year, month, day, hour, minute, second))
}
