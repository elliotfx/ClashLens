import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
    try {
        const clans = await prisma.clan.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                tag: true,
                name: true,
                level: true,
                members: true,
                badgeUrls: true,
            },
        })

        return NextResponse.json({ clans })
    } catch (error) {
        console.error('[API] List clans error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch clans' },
            { status: 500 }
        )
    }
}
