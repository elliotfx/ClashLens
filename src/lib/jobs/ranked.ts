import { prisma } from '../db'
import { cocClient, CoCAPIError } from '../coc/client'
import { getWeekId, getPreviousWeekId, getDateString, isDateSunday, getRankedLeagueTier } from '../utils/week'

/**
 * Collect ranked data for all players in a clan
 */
export async function collectRankedData(clanTag: string): Promise<void> {
    console.log(`[Ranked] Starting ranked data collection for clan ${clanTag}`)

    const today = new Date()
    const weekId = getWeekId(today)
    const dateStr = getDateString(today)
    const sundayFlag = isDateSunday(today)

    try {
        // Get clan from database
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
            include: { players: true },
        })

        if (!clan) {
            console.error(`[Ranked] Clan ${clanTag} not found`)
            return
        }

        console.log(`[Ranked] Processing ${clan.players.length} players for week ${weekId}`)

        let successCount = 0
        let errorCount = 0

        for (const player of clan.players) {
            try {
                // Fetch player data from API
                const playerData = await cocClient.getPlayer(player.tag)

                // Extract ranked data (if available in API response)
                // Note: The actual API field names may differ - adjust based on real API
                const rankedLeague = extractRankedLeague(playerData)
                const rankedTrophies = extractRankedTrophies(playerData)

                // Get previous week data for promotion/demotion tracking
                const previousWeekId = getPreviousWeekId(today)
                const previousWeekData = await prisma.playerRankedWeek.findUnique({
                    where: {
                        playerId_weekId: {
                            playerId: player.id,
                            weekId: previousWeekId,
                        },
                    },
                })

                // Determine promotion/demotion
                const currentTier = getRankedLeagueTier(rankedLeague)
                const previousTier = getRankedLeagueTier(previousWeekData?.leagueRanked)
                const promoted = currentTier > previousTier && previousTier > 0
                const demoted = currentTier < previousTier && currentTier > 0

                // Upsert ranked week data
                await prisma.playerRankedWeek.upsert({
                    where: {
                        playerId_weekId: {
                            playerId: player.id,
                            weekId,
                        },
                    },
                    update: {
                        leagueRanked: rankedLeague,
                        rankedTrophies,
                        weeklyAttacks: incrementValue(playerData.attackWins),
                        weeklyStars: incrementValue(playerData.warStars),
                        promoted,
                        demoted,
                        previousLeague: previousWeekData?.leagueRanked || null,
                        jsonRaw: playerData as any,
                    },
                    create: {
                        playerId: player.id,
                        weekId,
                        leagueRanked: rankedLeague,
                        rankedTrophies,
                        weeklyAttacks: playerData.attackWins || 0,
                        weeklyStars: playerData.warStars || 0,
                        previousLeague: previousWeekData?.leagueRanked || null,
                        promoted,
                        demoted,
                        jsonRaw: playerData as any,
                    },
                })

                // Store daily trophies
                await prisma.playerTrophiesDaily.upsert({
                    where: {
                        playerId_date: {
                            playerId: player.id,
                            date: new Date(dateStr),
                        },
                    },
                    update: {
                        trophies: playerData.trophies,
                        isSunday: sundayFlag,
                    },
                    create: {
                        playerId: player.id,
                        date: new Date(dateStr),
                        weekId,
                        trophies: playerData.trophies,
                        isSunday: sundayFlag,
                    },
                })

                successCount++
            } catch (error) {
                errorCount++
                if (error instanceof CoCAPIError && error.statusCode === 404) {
                    console.log(`[Ranked] Player ${player.tag} not found`)
                } else {
                    console.error(`[Ranked] Error for player ${player.tag}:`, error)
                }
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100))
        }

        console.log(`[Ranked] Completed: ${successCount} success, ${errorCount} errors`)
    } catch (error) {
        console.error('[Ranked] Collection error:', error)
        throw error
    }
}

/**
 * Collect ranked data for all clans
 */
export async function collectAllRankedData(): Promise<void> {
    console.log('[Ranked] Starting ranked data collection for all clans')

    const clans = await prisma.clan.findMany()

    for (const clan of clans) {
        try {
            await collectRankedData(clan.tag)
        } catch (error) {
            console.error(`[Ranked] Failed for clan ${clan.tag}:`, error)
        }

        // Delay between clans
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log('[Ranked] All clans processed')
}

/**
 * Extract ranked league from player data
 * Priority: leagueTier (Ranked Battles) > builderBaseLeague > league
 */
function extractRankedLeague(playerData: any): string | null {
    // New Ranked Battles league (2025)
    if (playerData.leagueTier?.name) {
        return playerData.leagueTier.name
    }
    // Builder Base league as fallback
    if (playerData.builderBaseLeague?.name) {
        return playerData.builderBaseLeague.name
    }
    // Regular league as last fallback
    if (playerData.league?.name) {
        return playerData.league.name
    }
    return null
}

/**
 * Extract ranked trophies from player data
 * When leagueTier is present, use trophies (the new ranked system)
 */
function extractRankedTrophies(playerData: any): number | null {
    // If player has leagueTier, trophies is the ranked trophies
    if (playerData.leagueTier && typeof playerData.trophies === 'number') {
        return playerData.trophies
    }
    // Fallback to builderBaseTrophies
    if (typeof playerData.builderBaseTrophies === 'number') {
        return playerData.builderBaseTrophies
    }
    return null
}

/**
 * Helper to increment attack/star values safely
 */
function incrementValue(value: number | undefined): number {
    return value || 0
}
