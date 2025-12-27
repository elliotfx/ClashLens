import { prisma } from '../db'
import { cocClient, CoCAPIError } from '../coc/client'

export async function collectClanSnapshot(clanTag: string): Promise<void> {
    console.log(`[Snapshot] Starting snapshot collection for clan ${clanTag}`)

    try {
        // Get clan from database
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
        })

        if (!clan) {
            console.error(`[Snapshot] Clan ${clanTag} not found in database`)
            return
        }

        // Fetch clan data from API
        const clanData = await cocClient.getClan(clanTag)

        // Create clan snapshot
        await prisma.clanSnapshot.create({
            data: {
                clanId: clan.id,
                members: clanData.members,
                clanPoints: clanData.clanPoints,
                clanVersusPoints: clanData.clanVersusPoints,
                requiredTrophies: clanData.requiredTrophies,
                warWins: clanData.warWins,
                warWinStreak: clanData.warWinStreak,
                warTies: clanData.warTies,
                warLosses: clanData.warLosses,
                jsonRaw: clanData as any,
            },
        })

        console.log(`[Snapshot] Clan snapshot created for ${clanData.name}`)

        // Fetch member list
        const memberList = clanData.memberList || []
        console.log(`[Snapshot] Collecting data for ${memberList.length} members`)

        let successCount = 0
        let errorCount = 0

        // Process members
        for (const member of memberList) {
            try {
                await collectPlayerSnapshot(member.tag, clan.id)
                successCount++
            } catch (error) {
                errorCount++
                console.error(`[Snapshot] Failed to collect data for player ${member.tag}:`, error)
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100))
        }

        console.log(`[Snapshot] Completed: ${successCount} players successful, ${errorCount} errors`)
    } catch (error) {
        if (error instanceof CoCAPIError) {
            console.error(`[Snapshot] CoC API Error:`, error.message)
        } else {
            console.error(`[Snapshot] Unexpected error:`, error)
        }
        throw error
    }
}

export async function collectPlayerSnapshot(playerTag: string, clanId?: string): Promise<void> {
    try {
        // Fetch player data from API
        const playerData = await cocClient.getPlayer(playerTag)

        // Find or create player in database
        let player = await prisma.player.findUnique({
            where: { tag: playerTag },
        })

        if (!player) {
            player = await prisma.player.create({
                data: {
                    tag: playerTag,
                    name: playerData.name,
                    townHallLevel: playerData.townHallLevel,
                    expLevel: playerData.expLevel,
                    leagueTier: (playerData as any).leagueTier?.name,  // Ranked league
                    clanId: clanId,
                    role: playerData.role,
                },
            })
        } else {
            // Update player info
            await prisma.player.update({
                where: { tag: playerTag },
                data: {
                    name: playerData.name,
                    townHallLevel: playerData.townHallLevel,
                    expLevel: playerData.expLevel,
                    leagueTier: (playerData as any).leagueTier?.name,  // Ranked league
                    trophies: playerData.trophies,
                    donations: playerData.donations,
                    donationsReceived: playerData.donationsReceived,
                    clanId: clanId,
                    role: playerData.role,
                },
            })
        }

        // Create player snapshot
        await prisma.playerSnapshot.create({
            data: {
                playerId: player.id,
                trophies: playerData.trophies,
                bestTrophies: playerData.bestTrophies,
                donationsSent: playerData.donations,
                donationsReceived: playerData.donationsReceived,
                attackWins: playerData.attackWins,
                defenseWins: playerData.defenseWins,
                townHallLevel: playerData.townHallLevel,
                expLevel: playerData.expLevel,
                warStars: playerData.warStars,
                jsonRaw: playerData as any,
            },
        })
    } catch (error) {
        if (error instanceof CoCAPIError && error.statusCode === 404) {
            console.log(`[Snapshot] Player ${playerTag} not found (may have left clan)`)
        } else {
            throw error
        }
    }
}

export async function collectAllClanSnapshots(): Promise<void> {
    console.log('[Snapshot] Starting snapshot collection for all clans')

    const clans = await prisma.clan.findMany()
    console.log(`[Snapshot] Found ${clans.length} clans`)

    for (const clan of clans) {
        try {
            await collectClanSnapshot(clan.tag)
        } catch (error) {
            console.error(`[Snapshot] Failed to collect snapshot for ${clan.tag}:`, error)
        }

        // Delay between clans to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log('[Snapshot] Snapshot collection completed')
}
