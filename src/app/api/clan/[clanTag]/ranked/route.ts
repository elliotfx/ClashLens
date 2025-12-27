import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cocClient } from '@/lib/coc/client'
import { getWeekId, getPreviousWeekId } from '@/lib/utils/week'
import { getRankedLeagueTier, getLeagueDisplayInfo } from '@/lib/utils/rankedLeagues'

export async function GET(
    request: NextRequest,
    { params }: { params: { clanTag: string } }
) {
    try {
        const clanTag = cocClient.normalizeTag(params.clanTag)
        const searchParams = request.nextUrl.searchParams
        const weekId = searchParams.get('weekId') || getWeekId()

        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
        })

        if (!clan) {
            return NextResponse.json({ error: 'Clan not found' }, { status: 404 })
        }

        // Get ranked data for the week
        const rankedData = await prisma.playerRankedWeek.findMany({
            where: {
                player: { clanId: clan.id },
                weekId,
            },
            include: {
                player: { select: { name: true, tag: true, townHallLevel: true } },
            },
            orderBy: { rankedTrophies: 'desc' },
        })

        // Get previous week for comparison
        const previousWeekId = getPreviousWeekId()
        const previousWeekData = await prisma.playerRankedWeek.findMany({
            where: {
                player: { clanId: clan.id },
                weekId: previousWeekId,
            },
            select: { playerId: true, leagueRanked: true, rankedTrophies: true },
        })

        const previousMap = new Map(previousWeekData.map(p => [p.playerId, p]))

        // Get last 8 weeks of Sunday trophies for chart
        const weeks: string[] = []
        let date = new Date()
        for (let i = 0; i < 8; i++) {
            weeks.push(getWeekId(date))
            date.setDate(date.getDate() - 7)
        }

        const sundayTrophies = await prisma.playerTrophiesDaily.findMany({
            where: {
                player: { clanId: clan.id },
                weekId: { in: weeks },
                isSunday: true,
            },
            include: {
                player: { select: { name: true, tag: true } },
            },
            orderBy: { date: 'asc' },
        })

        // Calculate stats
        const promotions = rankedData.filter(r => r.promoted).length
        const demotions = rankedData.filter(r => r.demoted).length

        // League distribution
        const leagueDistribution: { [key: string]: number } = {}
        rankedData.forEach(r => {
            if (r.leagueRanked) {
                leagueDistribution[r.leagueRanked] = (leagueDistribution[r.leagueRanked] || 0) + 1
            }
        })

        // Format for charts - sorted by league tier (lowest to highest for bar chart)
        const leagueChartData = Object.entries(leagueDistribution)
            .map(([league, count]) => ({
                league,
                count,
                tier: getRankedLeagueTier(league),
            }))
            .sort((a, b) => a.tier - b.tier) // Sort by tier (lowest first for chart)

        // Weekly trophy history (aggregated by week)
        const weeklyHistory: { [weekId: string]: { total: number; count: number } } = {}
        sundayTrophies.forEach(t => {
            if (!weeklyHistory[t.weekId]) {
                weeklyHistory[t.weekId] = { total: 0, count: 0 }
            }
            weeklyHistory[t.weekId].total += t.trophies
            weeklyHistory[t.weekId].count++
        })

        const weeklyChartData = Object.entries(weeklyHistory)
            .map(([week, data]) => ({
                weekId: week,
                avgTrophies: Math.round(data.total / data.count),
            }))
            .sort((a, b) => a.weekId.localeCompare(b.weekId))

        return NextResponse.json({
            weekId,
            stats: {
                totalPlayers: rankedData.length,
                promotions,
                demotions,
                playersWithRanked: rankedData.filter(r => r.leagueRanked).length,
            },
            leagueDistribution: leagueChartData,
            weeklyHistory: weeklyChartData,
            players: rankedData
                .map(r => {
                    const prev = previousMap.get(r.playerId)
                    const leagueInfo = getLeagueDisplayInfo(r.leagueRanked)
                    return {
                        tag: r.player.tag,
                        name: r.player.name,
                        townHall: r.player.townHallLevel,
                        league: r.leagueRanked,
                        leagueTier: leagueInfo.tier,
                        leagueColor: leagueInfo.color,
                        trophies: r.rankedTrophies,
                        attacks: r.weeklyAttacks,
                        stars: r.weeklyStars,
                        promoted: r.promoted,
                        demoted: r.demoted,
                        previousLeague: prev?.leagueRanked || null,
                        trophyChange: prev?.rankedTrophies
                            ? (r.rankedTrophies || 0) - prev.rankedTrophies
                            : null,
                    }
                })
                .sort((a, b) => b.leagueTier - a.leagueTier), // Sort by league tier (highest first)
        })
    } catch (error) {
        console.error('[API] Ranked stats error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch ranked stats' },
            { status: 500 }
        )
    }
}
