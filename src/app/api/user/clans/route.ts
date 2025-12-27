import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ clans: [] })
        }

        const clans = await prisma.clan.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' },
            select: {
                tag: true,
                name: true,
                level: true,
                members: true,
            },
        })

        return NextResponse.json({ clans })
    } catch (error) {
        console.error('[API] User clans error:', error)
        return NextResponse.json({ clans: [] })
    }
}
