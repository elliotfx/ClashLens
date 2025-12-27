import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Non autorisé' },
                { status: 401 }
            )
        }

        const { clanTag } = await request.json()

        if (!clanTag) {
            return NextResponse.json(
                { error: 'Tag du clan requis' },
                { status: 400 }
            )
        }

        // Find the clan and verify ownership
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
        })

        if (!clan) {
            return NextResponse.json(
                { error: 'Clan non trouvé' },
                { status: 404 }
            )
        }

        if (clan.userId !== session.user.id) {
            return NextResponse.json(
                { error: 'Vous ne pouvez pas déconnecter ce clan' },
                { status: 403 }
            )
        }

        // Remove user association (don't delete the clan data)
        await prisma.clan.update({
            where: { tag: clanTag },
            data: { userId: null },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Disconnect clan error:', error)
        return NextResponse.json(
            { error: 'Erreur lors de la déconnexion du clan' },
            { status: 500 }
        )
    }
}
