import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const clanTag = searchParams.get('clanTag')

        if (!clanTag) {
            return NextResponse.json({ error: 'Clan tag is required' }, { status: 400 })
        }

        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
            select: { snapshotFrequency: true }
        })

        if (!clan) {
            return NextResponse.json({ error: 'Clan not found' }, { status: 404 })
        }

        const snapshotFrequency = clan.snapshotFrequency || 60
        return NextResponse.json({ snapshotFrequency })
    } catch (error) {
        console.error('[API] Settings GET error:', error)
        return NextResponse.json({ error: 'Erreur lors de la récupération des paramètres' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { clanTag, snapshotFrequency } = body

        if (!clanTag) {
            return NextResponse.json({ error: 'Clan tag is required' }, { status: 400 })
        }

        if (!snapshotFrequency || ![15, 30, 60, 120, 360].includes(Number(snapshotFrequency))) {
            return NextResponse.json(
                { error: 'Fréquence invalide. Valeurs acceptées: 15, 30, 60, 120, 360' },
                { status: 400 }
            )
        }

        // Update ONLY this specific clan
        const result = await prisma.clan.updateMany({
            where: { tag: clanTag },
            data: { snapshotFrequency: Number(snapshotFrequency) }
        })

        if (result.count === 0) {
            return NextResponse.json(
                { error: 'Clan not found' },
                { status: 404 }
            )
        }

        console.log(`[API] Updated snapshot frequency for clan ${clanTag} to ${snapshotFrequency} minutes`)

        return NextResponse.json({
            success: true,
            message: 'Paramètres sauvegardés avec succès',
            snapshotFrequency: Number(snapshotFrequency)
        })
    } catch (error) {
        console.error('[API] Settings POST error:', error)
        return NextResponse.json({ error: 'Erreur lors de la sauvegarde des paramètres' }, { status: 500 })
    }
}
