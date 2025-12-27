import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cocClient } from '@/lib/coc/client'
import { calculateIRJ, getTrophyDelta } from '@/lib/utils/irj'

export async function GET(
    request: NextRequest,
    { params }: { params: { playerTag: string } }
) {
    try {
        const playerTag = cocClient.normalizeTag(params.playerTag)

        // Get player with snapshots
        const player = await prisma.player.findUnique({
            where: { tag: playerTag },
            include: {
                clan: true,
                snapshots: {
                    orderBy: { timestamp: 'desc' },
                    take: 500, // Last 500 snapshots for charts
                },
            },
        })

        if (!player) {
            return NextResponse.json(
                { error: 'Player not found' },
                { status: 404 }
            )
        }

        // Calculate IRJ
        const irj = calculateIRJ(
            player.snapshots.map(s => ({
                timestamp: s.timestamp,
                trophies: s.trophies,
                donationsSent: s.donationsSent || undefined,
                attackWins: s.attackWins || undefined,
            }))
        )

        // Get trophy deltas
        const trophyDelta7d = getTrophyDelta(
            player.snapshots.map(s => ({
                timestamp: s.timestamp,
                trophies: s.trophies,
            })),
            7
        )

        const trophyDelta30d = getTrophyDelta(
            player.snapshots.map(s => ({
                timestamp: s.timestamp,
                trophies: s.trophies,
            })),
            30
        )

        const latestSnapshot = player.snapshots[0]

        return NextResponse.json({
            player: {
                tag: player.tag,
                name: player.name,
                townHallLevel: player.townHallLevel,
                expLevel: player.expLevel,
                league: player.league,
                role: player.role,
                clan: player.clan
                    ? {
                        tag: player.clan.tag,
                        name: player.clan.name,
                    }
                    : null,
            },
            stats: {
                currentTrophies: latestSnapshot?.trophies || 0,
                bestTrophies: latestSnapshot?.bestTrophies || 0,
                trophyDelta7d,
                trophyDelta30d,
                donations: latestSnapshot?.donationsSent || 0,
                donationsReceived: latestSnapshot?.donationsReceived || 0,
                attackWins: latestSnapshot?.attackWins || 0,
                defenseWins: latestSnapshot?.defenseWins || 0,
                warStars: latestSnapshot?.warStars || 0,
            },
            irj: {
                totalScore: irj.totalScore,
                components: irj,
            },
            snapshots: player.snapshots.map(s => ({
                timestamp: s.timestamp,
                trophies: s.trophies,
                donations: s.donationsSent,
                attackWins: s.attackWins,
            })),
        })
    } catch (error) {
        console.error('[API] Get player error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch player data' },
            { status: 500 }
        )
    }
}
