import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { cocClient, CoCAPIError } from '@/lib/coc/client'

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Vous devez être connecté pour ajouter un clan' },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { clanTag } = body

        if (!clanTag) {
            return NextResponse.json(
                { error: 'Clan tag is required' },
                { status: 400 }
            )
        }

        const normalizedTag = cocClient.normalizeTag(clanTag)

        // Check if clan already exists
        let existingClan = await prisma.clan.findUnique({
            where: { tag: normalizedTag },
        })

        if (existingClan) {
            // If clan exists but belongs to another user
            if (existingClan.userId && existingClan.userId !== session.user.id) {
                return NextResponse.json(
                    { error: 'Ce clan est déjà connecté à un autre compte' },
                    { status: 409 }
                )
            }

            // If clan exists without owner, claim it for this user
            if (!existingClan.userId) {
                existingClan = await prisma.clan.update({
                    where: { tag: normalizedTag },
                    data: { userId: session.user.id },
                })
            }

            return NextResponse.json({
                success: true,
                clan: {
                    tag: existingClan.tag,
                    name: existingClan.name,
                },
            })
        }

        // Validate and fetch clan from CoC API
        let clanData
        try {
            clanData = await cocClient.getClan(clanTag)
        } catch (error) {
            if (error instanceof CoCAPIError) {
                return NextResponse.json(
                    { error: error.message, reason: error.reason },
                    { status: error.statusCode || 400 }
                )
            }
            throw error
        }

        // Create clan in database linked to user
        const clan = await prisma.clan.create({
            data: {
                tag: normalizedTag,
                name: clanData.name,
                description: clanData.description,
                level: clanData.clanLevel,
                members: clanData.members,
                requiredTrophies: clanData.requiredTrophies,
                warFrequency: clanData.warFrequency,
                location: clanData.location?.name,
                badgeUrls: clanData.badgeUrls as any,
                isWarLogPublic: clanData.isWarLogPublic,
                userId: session.user.id,
            },
        })

        return NextResponse.json({
            success: true,
            clan: {
                id: clan.id,
                tag: clan.tag,
                name: clan.name,
                description: clan.description,
                level: clan.level,
                members: clan.members,
                badgeUrls: clan.badgeUrls,
            },
        })
    } catch (error) {
        console.error('[API] Clan connect error:', error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Failed to connect clan',
            },
            { status: 500 }
        )
    }
}
