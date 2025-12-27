import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cocClient } from '@/lib/coc/client'

export async function GET(
    request: NextRequest,
    { params }: { params: { clanTag: string } }
) {
    try {
        const clanTag = cocClient.normalizeTag(params.clanTag)

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

        // Get wars for this clan
        const wars = await prisma.war.findMany({
            where: { clanId: clan.id },
            orderBy: { endTime: 'desc' },
            take: 50,
        })

        return NextResponse.json({
            wars: wars.map(war => ({
                id: war.id,
                warKey: war.warKey,
                state: war.state,
                teamSize: war.teamSize,
                preparationStartTime: war.preparationStartTime,
                startTime: war.startTime,
                endTime: war.endTime,
                opponent: {
                    tag: war.opponentTag,
                    name: war.opponentName,
                },
                result: war.result,
                clanStats: {
                    stars: war.stars,
                    destructionPercentage: war.destructionPercentage,
                },
                opponentStats: {
                    stars: war.opponentStars,
                    destructionPercentage: war.opponentDestructionPercentage,
                },
            })),
            total: wars.length,
        })
    } catch (error) {
        console.error('[API] Get wars error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch wars' },
            { status: 500 }
        )
    }
}
