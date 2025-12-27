import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cocClient } from '@/lib/coc/client'
import { calculateIRJ, getTrophyDelta } from '@/lib/utils/irj'
import { calculateLeaguePerformance } from '@/lib/utils/leagueReference'
import { getWeekId } from '@/lib/utils/week'

export async function GET(
    request: NextRequest,
    { params }: { params: { clanTag: string } }
) {
    try {
        const clanTag = cocClient.normalizeTag(params.clanTag)
        const searchParams = request.nextUrl.searchParams
        const search = searchParams.get('search') || ''
        const sortBy = searchParams.get('sortBy') || 'leagueDelta'
        const sortOrder = searchParams.get('sortOrder') || 'desc'

        // Get clan
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
        })

        if (!clan) {
            return NextResponse.json(
                { error: 'Clan not found' },
                { status: 404 }
            )
        }

        // Get current week ID
        const currentWeekId = getWeekId()

        // Get all players for this clan with ranked data
        const players = await prisma.player.findMany({
            where: {
                clanId: clan.id,
                ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
            },
            include: {
                snapshots: {
                    orderBy: { timestamp: 'desc' },
                    take: 100,
                },
                rankedWeeks: {
                    orderBy: { weekId: 'desc' },
                    take: 1, // Get most recent ranked data
                },
            },
        })

        // Calculate stats for each player
        const membersWithStats = players.map((player) => {
            const irj = calculateIRJ(
                player.snapshots.map(s => ({
                    timestamp: s.timestamp,
                    trophies: s.trophies,
                    donationsSent: s.donationsSent || undefined,
                    attackWins: s.attackWins || undefined,
                })),
                undefined,
                {
                    trophies: player.trophies || player.snapshots[0]?.trophies || 0,
                    donations: player.donations || 0,  // Use player donations directly
                    donationsReceived: player.donationsReceived || 0,
                    townHallLevel: player.townHallLevel || 1,
                    expLevel: player.expLevel || 1,
                    role: player.role || 'member',
                    leagueTier: player.leagueTier || player.rankedWeeks?.[0]?.leagueRanked || null,
                }
            )

            const trophyDelta7d = getTrophyDelta(
                player.snapshots.map(s => ({
                    timestamp: s.timestamp,
                    trophies: s.trophies,
                })),
                7
            )

            const latestSnapshot = player.snapshots[0]
            const latestRanked = player.rankedWeeks[0]

            // Get ranked league from PlayerRankedWeek table
            const rankedLeague = latestRanked?.leagueRanked || null

            // Calculate league performance based on ranked league
            const leaguePerformance = calculateLeaguePerformance(
                rankedLeague,
                player.townHallLevel || 1
            )

            return {
                tag: player.tag,
                name: player.name,
                role: player.role,
                townHallLevel: player.townHallLevel,
                expLevel: player.expLevel,
                league: player.league, // Regular league
                rankedLeague, // Ranked league
                rankedTrophies: latestRanked?.rankedTrophies || null,
                currentTrophies: latestSnapshot?.trophies || 0,
                trophyDelta7d,
                donations7d: latestSnapshot?.donationsSent || 0,
                irjScore: irj.totalScore,
                irjComponents: irj,
                leaguePerformance,
                lastSeen: latestSnapshot?.timestamp || player.updatedAt,
            }
        })

        // Sort members
        const sorted = membersWithStats.sort((a, b) => {
            let aValue: number | string = a.irjScore
            let bValue: number | string = b.irjScore

            if (sortBy === 'name') {
                aValue = a.name.toLowerCase()
                bValue = b.name.toLowerCase()
            } else if (sortBy === 'trophies') {
                aValue = a.currentTrophies
                bValue = b.currentTrophies
            } else if (sortBy === 'trophyDelta') {
                aValue = a.trophyDelta7d
                bValue = b.trophyDelta7d
            } else if (sortBy === 'townHall') {
                aValue = a.townHallLevel || 0
                bValue = b.townHallLevel || 0
            } else if (sortBy === 'leagueDelta') {
                aValue = a.leaguePerformance.leagueDelta
                bValue = b.leaguePerformance.leagueDelta
            } else if (sortBy === 'irj') {
                aValue = a.irjScore
                bValue = b.irjScore
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1
            } else {
                return aValue < bValue ? 1 : -1
            }
        })

        return NextResponse.json({
            members: sorted,
            total: sorted.length,
        })
    } catch (error) {
        console.error('[API] Get members error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch members' },
            { status: 500 }
        )
    }
}
