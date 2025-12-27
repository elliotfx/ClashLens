import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// API endpoint to send Discord reminders to inactive players
// This will be called from the dashboard when clicking the reminder button

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Non authentifié' },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { playerTag, clanTag, message } = body

        if (!playerTag || !clanTag) {
            return NextResponse.json(
                { error: 'playerTag et clanTag requis' },
                { status: 400 }
            )
        }

        // Verify user owns this clan
        const clan = await prisma.clan.findFirst({
            where: {
                tag: clanTag,
                userId: session.user.id,
            },
        })

        if (!clan) {
            return NextResponse.json(
                { error: 'Clan non trouvé ou non autorisé' },
                { status: 403 }
            )
        }

        // Find player
        const player = await prisma.player.findFirst({
            where: {
                tag: playerTag,
                clanId: clan.id,
            },
        })

        if (!player) {
            return NextResponse.json(
                { error: 'Joueur non trouvé dans ce clan' },
                { status: 404 }
            )
        }

        // Find if player has a verified claim with a private channel
        const playerChannel = await prisma.playerChannel.findFirst({
            where: {
                playerId: player.id,
            },
        })

        if (!playerChannel) {
            return NextResponse.json(
                { error: 'Ce joueur n\'a pas de salon Discord privé. Il doit d\'abord revendiquer son profil avec /claim sur Discord.' },
                { status: 400 }
            )
        }

        // Store the message to be sent (will be picked up by the bot)
        // We'll use a simple approach: create a notification record
        // that the bot can poll or we can trigger via webhook

        // For now, return success with channel info - the actual sending
        // will be done via the Discord bot's API
        const discordConfig = await prisma.discordConfig.findFirst({
            where: { clanId: clan.id },
        })

        if (!discordConfig) {
            return NextResponse.json(
                { error: 'Aucune configuration Discord trouvée pour ce clan' },
                { status: 400 }
            )
        }

        return NextResponse.json({
            success: true,
            data: {
                playerName: player.name,
                playerTag: player.tag,
                channelId: playerChannel.discordChannelId,
                discordUserId: playerChannel.discordUserId,
                guildId: discordConfig.guildId,
                message: message || `Bonjour ${player.name} ! On a remarqué que tu n'as pas été actif récemment. Tout va bien ? 🎮`,
            },
        })
    } catch (error) {
        console.error('[API] Discord reminder error:', error)
        return NextResponse.json(
            { error: 'Erreur lors de l\'envoi du rappel' },
            { status: 500 }
        )
    }
}
