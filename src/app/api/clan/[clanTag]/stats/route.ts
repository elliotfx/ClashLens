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

        // Calculate player inactivity based on last snapshot data change
        const inactivityThreshold = 3 * 24 * 60 * 60 * 1000 // 3 days
        const now = new Date()

        const playersWithActivity = players.map(player => {
            const latestPlayerSnapshot = player.snapshots[0]
            const previousSnapshot = player.snapshots[1]

            // Determine last activity: when data actually changed
            let lastActivity: Date | null = null

            if (latestPlayerSnapshot) {
                // If we have multiple snapshots, find when data last changed
                if (previousSnapshot) {
                    // Compare key metrics to detect activity
                    const hasChanged = (
                        latestPlayerSnapshot.trophies !== previousSnapshot.trophies ||
                        latestPlayerSnapshot.donationsSent !== previousSnapshot.donationsSent ||
                        latestPlayerSnapshot.attackWins !== previousSnapshot.attackWins
                    )

                    if (hasChanged) {
                        lastActivity = latestPlayerSnapshot.timestamp
                    } else {
                        // Find the last snapshot where data changed
                        for (let i = 0; i < player.snapshots.length - 1; i++) {
                            const curr = player.snapshots[i]
                            const prev = player.snapshots[i + 1]
                            if (curr.trophies !== prev.trophies ||
                                curr.donationsSent !== prev.donationsSent ||
                                curr.attackWins !== prev.attackWins) {
                                lastActivity = curr.timestamp
                                break
                            }
                        }
                    }
                } else {
                    lastActivity = latestPlayerSnapshot.timestamp
                }
            }

            const inactiveSince = lastActivity ? now.getTime() - lastActivity.getTime() : null
            const isInactive = inactiveSince ? inactiveSince > inactivityThreshold : true
            const inactiveDays = inactiveSince ? Math.floor(inactiveSince / (24 * 60 * 60 * 1000)) : null

            return {
                tag: player.tag,
                name: player.name,
                townHallLevel: player.townHallLevel,
                trophies: latestPlayerSnapshot?.trophies || 0,
                lastActivity: lastActivity?.toISOString() || null,
                isInactive,
                inactiveDays,
            }
        })

        // Get inactive players sorted by inactivity duration
        const inactivePlayers = playersWithActivity
            .filter(p => p.isInactive)
            .sort((a, b) => (b.inactiveDays || 999) - (a.inactiveDays || 999))

        // Activity stats
        const activityStats = {
            totalPlayers: players.length,
            activePlayers: playersWithActivity.filter(p => !p.isInactive).length,
            inactivePlayers: inactivePlayers.length,
            inactiveRate: players.length > 0
                ? Math.round((inactivePlayers.length / players.length) * 100)
                : 0,
        }

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
            activityStats,
            inactivePlayers,
        })
    } catch (error) {
        console.error('[API] Get dashboard stats error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch dashboard stats' },
            { status: 500 }
        )
    }
}
