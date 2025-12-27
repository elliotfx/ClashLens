import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cocClient } from '@/lib/coc/client'

export async function GET(
    request: NextRequest,
    { params }: { params: { clanTag: string } }
) {
    try {
        const clanTag = cocClient.normalizeTag(params.clanTag)

        // Get clan from database
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
            include: {
                snapshots: {
                    orderBy: { timestamp: 'desc' },
                    take: 1,
                },
            },
        })

        if (!clan) {
            return NextResponse.json(
                { error: 'Clan not found' },
                { status: 404 }
            )
        }

        // Get latest snapshot data
        const latestSnapshot = clan.snapshots[0]

        // Get member count
        const memberCount = await prisma.player.count({
            where: { clanId: clan.id },
        })

        return NextResponse.json({
            clan: {
                id: clan.id,
                tag: clan.tag,
                name: clan.name,
                description: clan.description,
                level: clan.level,
                badgeUrls: clan.badgeUrls,
                location: clan.location,
                requiredTrophies: clan.requiredTrophies,
                warFrequency: clan.warFrequency,
                isWarLogPublic: clan.isWarLogPublic,
                memberCount,
            },
            latestSnapshot: latestSnapshot
                ? {
                    timestamp: latestSnapshot.timestamp,
                    members: latestSnapshot.members,
                    clanPoints: latestSnapshot.clanPoints,
                    clanVersusPoints: latestSnapshot.clanVersusPoints,
                    warWins: latestSnapshot.warWins,
                    warWinStreak: latestSnapshot.warWinStreak,
                }
                : null,
        })
    } catch (error) {
        console.error('[API] Get clan error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch clan data' },
            { status: 500 }
        )
    }
}
