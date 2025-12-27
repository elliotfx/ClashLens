import { prisma } from '../db'
import { cocClient, CoCAPIError } from '../coc/client'
import { calculateAttackScore } from '../utils/warAttackScore'

// Types for war data from API
interface WarMember {
    tag: string
    name: string
    townhallLevel: number
    mapPosition: number
    attacks?: Array<{
        attackerTag: string
        defenderTag: string
        stars: number
        destructionPercentage: number
        order: number
    }>
}

interface WarData {
    state: string
    clan: {
        tag: string
        name: string
        stars: number
        destructionPercentage: number
        members: WarMember[]
    }
    opponent: {
        tag: string
        name: string
        stars: number
        destructionPercentage: number
        members: WarMember[]
    }
    teamSize: number
    attacksPerMember: number
    preparationStartTime: string
    startTime: string
    endTime: string
}

/**
 * Generate a deterministic war key from war data
 */
function generateWarKey(clanTag: string, opponentTag: string, startTime: string): string {
    const tags = [clanTag, opponentTag].sort()
    return `${tags[0]}_${tags[1]}_${startTime}`
}

/**
 * Parse and store individual attacks from war data
 */
async function parseWarAttacks(warId: string, warData: WarData): Promise<number> {
    const clanMembers = warData.clan.members || []
    const opponentMembers = warData.opponent.members || []

    // Create lookup for defender TH levels
    const defenderLookup: Map<string, WarMember> = new Map()
    opponentMembers.forEach(m => defenderLookup.set(m.tag, m))
    clanMembers.forEach(m => defenderLookup.set(m.tag, m))

    // Create lookup for our clan members
    const attackerLookup: Map<string, WarMember> = new Map()
    clanMembers.forEach(m => attackerLookup.set(m.tag, m))

    let attackCount = 0

    // Process attacks from our clan members
    for (const member of clanMembers) {
        if (!member.attacks) continue

        for (const attack of member.attacks) {
            const defender = defenderLookup.get(attack.defenderTag)
            if (!defender) continue

            const attackerTH = member.townhallLevel
            const defenderTH = defender.townhallLevel

            // Calculate score
            const scoreResult = calculateAttackScore(
                attackerTH,
                defenderTH,
                attack.stars,
                attack.destructionPercentage
            )

            // Check if attack already exists
            const existingAttack = await prisma.warAttack.findFirst({
                where: {
                    warId,
                    attackerTag: attack.attackerTag,
                    defenderTag: attack.defenderTag,
                },
            })

            if (!existingAttack) {
                await prisma.warAttack.create({
                    data: {
                        warId,
                        attackerTag: attack.attackerTag,
                        attackerName: member.name,
                        attackerTH,
                        defenderTag: attack.defenderTag,
                        defenderName: defender.name,
                        defenderTH,
                        defenderMapPos: defender.mapPosition,
                        stars: attack.stars,
                        destructionPct: attack.destructionPercentage,
                        order: attack.order,
                        attackScore: scoreResult.score,
                        thDiff: scoreResult.thDiff,
                        category: scoreResult.category,
                        rating: scoreResult.rating,
                    },
                })
                attackCount++
            }
        }
    }

    return attackCount
}

export async function collectWarData(clanTag: string): Promise<void> {
    console.log(`[War] Collecting war data for clan ${clanTag}`)

    try {
        // Get clan from database
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
        })

        if (!clan) {
            console.error(`[War] Clan ${clanTag} not found in database`)
            return
        }

        // Try to fetch current war
        try {
            const warData = await cocClient.getCurrentWar(clanTag)

            // Only store if there's an actual war (not "notInWar")
            if (warData.state !== 'notInWar' && warData.state !== undefined) {
                const warKey = generateWarKey(
                    warData.clan.tag,
                    warData.opponent.tag,
                    warData.startTime
                )

                // Check if war already exists
                const existingWar = await prisma.war.findUnique({
                    where: { warKey },
                })

                if (!existingWar) {
                    // Create new war entry
                    await prisma.war.create({
                        data: {
                            warKey,
                            clanId: clan.id,
                            state: warData.state,
                            teamSize: warData.teamSize,
                            attacksPerMember: warData.attacksPerMember,
                            preparationStartTime: new Date(warData.preparationStartTime),
                            startTime: new Date(warData.startTime),
                            endTime: new Date(warData.endTime),
                            opponentTag: warData.opponent.tag,
                            opponentName: warData.opponent.name,
                            result: warData.state === 'warEnded' ? determineResult(warData) : null,
                            stars: warData.clan.stars,
                            destructionPercentage: warData.clan.destructionPercentage,
                            opponentStars: warData.opponent.stars,
                            opponentDestructionPercentage: warData.opponent.destructionPercentage,
                            jsonRaw: warData as any,
                        },
                    })
                    console.log(`[War] Created new war entry: ${warKey}`)

                    // Parse and store individual attacks
                    const newWar = await prisma.war.findUnique({ where: { warKey } })
                    if (newWar && (warData.state === 'inWar' || warData.state === 'warEnded')) {
                        const attackCount = await parseWarAttacks(newWar.id, warData as WarData)
                        console.log(`[War] Parsed ${attackCount} attacks for war ${warKey}`)
                    }
                } else {
                    // Update existing war (e.g., if it went from preparation to active)
                    await prisma.war.update({
                        where: { warKey },
                        data: {
                            state: warData.state,
                            result: warData.state === 'warEnded' ? determineResult(warData) : existingWar.result,
                            stars: warData.clan.stars,
                            destructionPercentage: warData.clan.destructionPercentage,
                            opponentStars: warData.opponent.stars,
                            opponentDestructionPercentage: warData.opponent.destructionPercentage,
                            jsonRaw: warData as any,
                        },
                    })
                    console.log(`[War] Updated war entry: ${warKey}`)

                    // Parse any new attacks
                    if (warData.state === 'inWar' || warData.state === 'warEnded') {
                        const attackCount = await parseWarAttacks(existingWar.id, warData as WarData)
                        if (attackCount > 0) {
                            console.log(`[War] Parsed ${attackCount} new attacks for war ${warKey}`)
                        }
                    }
                }
            } else {
                console.log(`[War] No active war for ${clanTag}`)
            }
        } catch (error) {
            if (error instanceof CoCAPIError && error.reason === 'accessDenied') {
                console.log(`[War] War log is private for ${clanTag}`)
            } else {
                throw error
            }
        }

        // Try to fetch war log (if public)
        try {
            const warLog = await cocClient.getWarLog(clanTag)

            if (warLog.items && warLog.items.length > 0) {
                console.log(`[War] Processing ${warLog.items.length} war log entries`)

                for (const warEntry of warLog.items) {
                    if (!warEntry.opponent || !warEntry.endTime) continue

                    const warKey = generateWarKey(
                        clan.tag,
                        warEntry.opponent.tag,
                        warEntry.endTime
                    )

                    // Check if already exists
                    const existingWar = await prisma.war.findUnique({
                        where: { warKey },
                    })

                    if (!existingWar) {
                        await prisma.war.create({
                            data: {
                                warKey,
                                clanId: clan.id,
                                state: 'warEnded',
                                teamSize: warEntry.teamSize,
                                attacksPerMember: warEntry.attacksPerMember || 2,
                                endTime: new Date(warEntry.endTime),
                                opponentTag: warEntry.opponent.tag,
                                opponentName: warEntry.opponent.name,
                                result: warEntry.result,
                                stars: warEntry.clan.stars,
                                destructionPercentage: warEntry.clan.destructionPercentage,
                                opponentStars: warEntry.opponent.stars,
                                opponentDestructionPercentage: warEntry.opponent.destructionPercentage,
                                jsonRaw: warEntry as any,
                            },
                        })
                    }
                }
            }
        } catch (error) {
            if (error instanceof CoCAPIError && error.reason === 'accessDenied') {
                console.log(`[War] War log is private for ${clanTag} - skipping`)
                // Update clan to mark war log as private
                await prisma.clan.update({
                    where: { id: clan.id },
                    data: { isWarLogPublic: false },
                })
            } else {
                throw error
            }
        }

        console.log(`[War] War data collection completed for ${clanTag}`)
    } catch (error) {
        console.error(`[War] Error collecting war data:`, error)
        throw error
    }
}

function determineResult(warData: any): string {
    const clanStars = warData.clan.stars
    const opponentStars = warData.opponent.stars
    const clanDestruction = warData.clan.destructionPercentage
    const opponentDestruction = warData.opponent.destructionPercentage

    if (clanStars > opponentStars) return 'win'
    if (clanStars < opponentStars) return 'lose'
    if (clanDestruction > opponentDestruction) return 'win'
    if (clanDestruction < opponentDestruction) return 'lose'
    return 'tie'
}

export async function collectAllWarsData(): Promise<void> {
    console.log('[War] Starting war data collection for all clans')

    const clans = await prisma.clan.findMany()
    console.log(`[War] Found ${clans.length} clans`)

    for (const clan of clans) {
        try {
            await collectWarData(clan.tag)
        } catch (error) {
            console.error(`[War] Failed to collect war data for ${clan.tag}:`, error)
        }

        // Delay between clans
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log('[War] War data collection completed')
}
