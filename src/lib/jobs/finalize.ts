import { prisma } from '../db'
import { getWeekId, getPreviousWeekId, getWeekEnd } from '../utils/week'

/**
 * Weekly finalization job
 * - Locks ranked data for the previous week
 * - Purges non-Sunday daily trophies from the previous week
 * - Should run every Monday morning
 */
export async function finalizeWeek(): Promise<void> {
    const today = new Date()
    const previousWeekId = getPreviousWeekId(today)

    console.log(`[Finalize] Starting weekly finalization for ${previousWeekId}`)

    try {
        // 1. Finalize all ranked week entries for the previous week
        const finalizedCount = await prisma.playerRankedWeek.updateMany({
            where: {
                weekId: previousWeekId,
                finalizedAt: null,
            },
            data: {
                finalizedAt: new Date(),
            },
        })

        console.log(`[Finalize] Locked ${finalizedCount.count} ranked week entries`)

        // 2. Purge non-Sunday daily trophies for previous week
        // Keep only Sunday records for historical data
        const purgedCount = await prisma.playerTrophiesDaily.deleteMany({
            where: {
                weekId: previousWeekId,
                isSunday: false,
            },
        })

        console.log(`[Finalize] Purged ${purgedCount.count} daily trophy records (kept Sundays)`)

        // 3. Log summary
        const remainingSundayRecords = await prisma.playerTrophiesDaily.count({
            where: {
                weekId: previousWeekId,
                isSunday: true,
            },
        })

        console.log(`[Finalize] Week ${previousWeekId} finalized:`)
        console.log(`  - Ranked entries locked: ${finalizedCount.count}`)
        console.log(`  - Daily records purged: ${purgedCount.count}`)
        console.log(`  - Sunday records kept: ${remainingSundayRecords}`)

    } catch (error) {
        console.error('[Finalize] Weekly finalization error:', error)
        throw error
    }
}

/**
 * Get weekly summary stats for a clan
 */
export async function getWeeklySummary(clanTag: string, weekId?: string): Promise<any> {
    const targetWeekId = weekId || getWeekId()

    try {
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
        })

        if (!clan) return null

        // Get all ranked data for the week
        const rankedData = await prisma.playerRankedWeek.findMany({
            where: {
                player: { clanId: clan.id },
                weekId: targetWeekId,
            },
            include: {
                player: {
                    select: { name: true, tag: true },
                },
            },
            orderBy: { rankedTrophies: 'desc' },
        })

        // Get Sunday trophies for the week
        const sundayTrophies = await prisma.playerTrophiesDaily.findMany({
            where: {
                player: { clanId: clan.id },
                weekId: targetWeekId,
                isSunday: true,
            },
            include: {
                player: {
                    select: { name: true, tag: true },
                },
            },
            orderBy: { trophies: 'desc' },
        })

        // Calculate stats
        const promotions = rankedData.filter(r => r.promoted).length
        const demotions = rankedData.filter(r => r.demoted).length

        // League distribution
        const leagueDistribution: { [league: string]: number } = {}
        rankedData.forEach(r => {
            if (r.leagueRanked) {
                leagueDistribution[r.leagueRanked] = (leagueDistribution[r.leagueRanked] || 0) + 1
            }
        })

        return {
            weekId: targetWeekId,
            totalPlayers: rankedData.length,
            promotions,
            demotions,
            leagueDistribution,
            topRanked: rankedData.slice(0, 10).map(r => ({
                name: r.player.name,
                tag: r.player.tag,
                league: r.leagueRanked,
                trophies: r.rankedTrophies,
                promoted: r.promoted,
                demoted: r.demoted,
            })),
            sundayTrophies: sundayTrophies.slice(0, 10).map(t => ({
                name: t.player.name,
                tag: t.player.tag,
                trophies: t.trophies,
            })),
        }
    } catch (error) {
        console.error('[Finalize] Get weekly summary error:', error)
        return null
    }
}
