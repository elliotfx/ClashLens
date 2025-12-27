import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cocClient } from '@/lib/coc/client'
import { getTrophyDelta } from '@/lib/utils/irj'
import { calculateLeaguePerformance } from '@/lib/utils/leagueReference'

export async function GET(
    request: NextRequest,
    { params }: { params: { clanTag: string } }
) {
    try {
        const clanTag = cocClient.normalizeTag(params.clanTag)

        // Get clan
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
            include: {
                snapshots: {
                    orderBy: { timestamp: 'desc' },
                    take: 60, // Last 60 snapshots for 30-day chart (assuming hourly)
                },
            },
        })

        if (!clan) {
            return NextResponse.json(
                { error: 'Clan not found' },
                { status: 404 }
            )
        }

        // Get all players with recent snapshots and ranked data
        const players = await prisma.player.findMany({
            where: { clanId: clan.id },
            include: {
                snapshots: {
                    orderBy: { timestamp: 'desc' },
                    take: 100,
                },
                rankedWeeks: {
                    orderBy: { weekId: 'desc' },
                    take: 1,
                },
            },
        })

        // Calculate KPIs
        const latestSnapshot = clan.snapshots[0]
        const memberCount = players.length
        const currentTrophies = latestSnapshot?.clanPoints || 0

        // Trophy variation (7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const snapshot7d = clan.snapshots.find(s => s.timestamp <= sevenDaysAgo)
        const trophyVariation7d = snapshot7d ? currentTrophies - snapshot7d.clanPoints : 0

        // Average TH level
        const avgTH =
            players.length > 0
                ? Math.round(
                    players.reduce((sum, p) => sum + (p.townHallLevel || 0), 0) / players.length
                )
                : 0

        // Top progressions (by trophy delta 7d)
        const progressions = players
            .map(player => {
                const delta = getTrophyDelta(
                    player.snapshots.map(s => ({
                        timestamp: s.timestamp,
                        trophies: s.trophies,
                    })),
                    7
                )
                return {
                    tag: player.tag,
                    name: player.name,
                    delta,
                    currentTrophies: player.snapshots[0]?.trophies || 0,
                }
            })
            .sort((a, b) => b.delta - a.delta)
            .slice(0, 10)

        // Trophy chart data (30 days)
        const trophyChartData = clan.snapshots
            .filter(s => s.timestamp >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
            .reverse()
            .map(s => ({
                timestamp: s.timestamp.toISOString(),
                trophies: s.clanPoints,
            }))

        // TH distribution
        const thDistribution: { [key: number]: number } = {}
        players.forEach(player => {
            const th = player.townHallLevel || 0
            thDistribution[th] = (thDistribution[th] || 0) + 1
        })

        const thDistributionData = Object.entries(thDistribution)
            .map(([th, count]) => ({
                townHall: parseInt(th),
                count,
            }))
            .sort((a, b) => a.townHall - b.townHall)

        // Calculate ranked performance distribution
        const rankedPerformance = {
            overperformer: 0,
            'on-target': 0,
            underperformer: 0,
            unranked: 0,
        }
        players.forEach((player: any) => {
            // Get ranked league from rankedWeeks table
            const rankedLeague = player.rankedWeeks?.[0]?.leagueRanked || null
            const perf = calculateLeaguePerformance(rankedLeague, player.townHallLevel || 1)
            rankedPerformance[perf.category as keyof typeof rankedPerformance]++
        })

        // Get snapshot metadata for data freshness indicator
        const firstSnapshot = clan.snapshots[clan.snapshots.length - 1]
        const lastSnapshot = clan.snapshots[0]
        const totalSnapshots = clan.snapshots.length

        return NextResponse.json({
            clan: {
                name: clan.name,
                tag: clan.tag,
                level: clan.level,
            },
            kpis: {
                memberCount,
                currentTrophies,
                trophyVariation7d,
                avgTownHall: avgTH,
                warWins: latestSnapshot?.warWins || 0,
                warWinStreak: latestSnapshot?.warWinStreak || 0,
            },
            topProgressions: progressions,
            rankedPerformance,
            snapshotInfo: {
                firstSnapshot: firstSnapshot?.timestamp || null,
                lastSnapshot: lastSnapshot?.timestamp || null,
                totalSnapshots,
            },
            charts: {
                trophyHistory: trophyChartData,
                thDistribution: thDistributionData,
            },
        })
    } catch (error) {
        console.error('[API] Get dashboard stats error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch dashboard stats' },
            { status: 500 }
        )
    }
}
