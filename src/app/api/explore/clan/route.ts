import { NextRequest, NextResponse } from 'next/server'
import { cocClient, CoCAPIError } from '@/lib/coc/client'

export async function GET(request: NextRequest) {
    const tag = request.nextUrl.searchParams.get('tag')

    if (!tag) {
        return NextResponse.json(
            { error: 'Le tag du clan est requis' },
            { status: 400 }
        )
    }

    try {
        const clanData = await cocClient.getClan(tag) as any

        return NextResponse.json({
            tag: clanData.tag,
            name: clanData.name,
            description: clanData.description,
            level: clanData.clanLevel,
            members: clanData.members,
            type: clanData.type,
            requiredTrophies: clanData.requiredTrophies,
            warWins: clanData.warWins,
            warWinStreak: clanData.warWinStreak,
            warLeague: clanData.warLeague,
            clanCapital: clanData.clanCapital,
            location: clanData.location,
            badgeUrls: clanData.badgeUrls,
            labels: clanData.labels,
            memberList: clanData.memberList?.map((m: any) => ({
                tag: m.tag,
                name: m.name,
                role: m.role,
                expLevel: m.expLevel,
                trophies: m.trophies,
                donations: m.donations,
                donationsReceived: m.donationsReceived,
                league: m.league,
            })),
        })
    } catch (error) {
        if (error instanceof CoCAPIError) {
            if (error.statusCode === 404) {
                return NextResponse.json(
                    { error: 'Clan non trouvé. Vérifiez le tag.' },
                    { status: 404 }
                )
            }
            return NextResponse.json(
                { error: error.message },
                { status: error.statusCode || 500 }
            )
        }

        console.error('[API] Explore clan error:', error)
        return NextResponse.json(
            { error: 'Erreur lors de la recherche du clan' },
            { status: 500 }
        )
    }
}
