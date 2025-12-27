import { NextRequest, NextResponse } from 'next/server'
import { cocClient, CoCAPIError } from '@/lib/coc/client'

interface WarMember {
    tag: string
    name: string
    townhallLevel: number
    mapPosition: number
    opponentAttacks?: number
    attacks?: Array<{
        attackerTag: string
        defenderTag: string
        stars: number
        destructionPercentage: number
        order: number
        duration: number
    }>
    bestOpponentAttack?: {
        attackerTag: string
        stars: number
        destructionPercentage: number
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { clanTag: string } }
) {
    try {
        const clanTag = decodeURIComponent(params.clanTag)

        const warData = await cocClient.getCurrentWar(clanTag)

        if (warData.state === 'notInWar') {
            return NextResponse.json({
                state: 'notInWar',
                message: 'Aucune guerre en cours'
            })
        }

        const clanMembers = (warData.clan.members || []) as WarMember[]
        const opponentMembers = (warData.opponent.members || []) as WarMember[]

        // Create a lookup for opponent members
        const opponentLookup = new Map<string, WarMember>()
        opponentMembers.forEach(m => opponentLookup.set(m.tag, m))

        // Calculate attack stats for each player
        const playerStats = clanMembers.map(member => {
            const attacks = member.attacks || []
            const usedAttacks = attacks.length
            const maxAttacks = warData.attacksPerMember || 2
            const totalStars = attacks.reduce((sum, a) => sum + a.stars, 0)
            const threeStars = attacks.filter(a => a.stars === 3).length

            // Get attack details with target info
            const attackDetails = attacks.map(attack => {
                const defender = opponentLookup.get(attack.defenderTag)
                return {
                    ...attack,
                    defenderName: defender?.name || 'Unknown',
                    defenderTH: defender?.townhallLevel || 0,
                    defenderPos: defender?.mapPosition || 0,
                    thDiff: (defender?.townhallLevel || 0) - member.townhallLevel,
                }
            })

            return {
                tag: member.tag,
                name: member.name,
                townhallLevel: member.townhallLevel,
                mapPosition: member.mapPosition,
                usedAttacks,
                maxAttacks,
                missedAttacks: maxAttacks - usedAttacks,
                totalStars,
                threeStars,
                attacks: attackDetails,
                opponentAttacks: member.opponentAttacks || 0,
                bestOpponentAttack: member.bestOpponentAttack,
            }
        })

        // Sort by map position
        playerStats.sort((a, b) => a.mapPosition - b.mapPosition)

        // Calculate who hasn't attacked yet
        const notAttacked = playerStats.filter(p => p.usedAttacks === 0)
        const partiallyAttacked = playerStats.filter(p => p.usedAttacks > 0 && p.usedAttacks < p.maxAttacks)
        const fullyAttacked = playerStats.filter(p => p.usedAttacks === p.maxAttacks)

        // Calculate time remaining
        const endTime = parseCoCADate(warData.endTime)
        const now = new Date()
        const timeRemaining = Math.max(0, endTime.getTime() - now.getTime())
        const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60))
        const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))

        // Overall stats
        const totalClanAttacks = playerStats.reduce((sum, p) => sum + p.usedAttacks, 0)
        const maxPossibleAttacks = playerStats.reduce((sum, p) => sum + p.maxAttacks, 0)

        return NextResponse.json({
            state: warData.state,
            teamSize: warData.teamSize,
            attacksPerMember: warData.attacksPerMember,
            startTime: warData.startTime,
            endTime: warData.endTime,
            timeRemaining: {
                hours: hoursRemaining,
                minutes: minutesRemaining,
                total: timeRemaining,
                formatted: `${hoursRemaining}h ${minutesRemaining}m`,
            },
            clan: {
                name: warData.clan.name,
                tag: warData.clan.tag,
                stars: warData.clan.stars,
                destructionPercentage: warData.clan.destructionPercentage,
                attacks: warData.clan.attacks || totalClanAttacks,
            },
            opponent: {
                name: warData.opponent.name,
                tag: warData.opponent.tag,
                badgeUrl: warData.opponent.badgeUrls?.medium,
                clanLevel: warData.opponent.clanLevel,
                stars: warData.opponent.stars,
                destructionPercentage: warData.opponent.destructionPercentage,
                attacks: warData.opponent.attacks || 0,
            },
            attackProgress: {
                used: totalClanAttacks,
                max: maxPossibleAttacks,
                percentage: maxPossibleAttacks > 0
                    ? Math.round((totalClanAttacks / maxPossibleAttacks) * 100)
                    : 0,
            },
            summary: {
                notAttacked: notAttacked.length,
                partiallyAttacked: partiallyAttacked.length,
                fullyAttacked: fullyAttacked.length,
            },
            players: playerStats,
            playersNotAttacked: notAttacked.map(p => ({
                tag: p.tag,
                name: p.name,
                th: p.townhallLevel,
                pos: p.mapPosition,
            })),
        })
    } catch (error: any) {
        console.error('[API] Current war error:', error)

        if (error.reason === 'accessDenied') {
            return NextResponse.json(
                { error: 'War log is private', state: 'private' },
                { status: 403 }
            )
        }

        return NextResponse.json(
            { error: error.message || 'Failed to fetch current war' },
            { status: 500 }
        )
    }
}

// Parse CoC API date format
function parseCoCADate(dateStr: string): Date {
    if (!dateStr) return new Date()
    const year = parseInt(dateStr.substring(0, 4))
    const month = parseInt(dateStr.substring(4, 6)) - 1
    const day = parseInt(dateStr.substring(6, 8))
    const hour = parseInt(dateStr.substring(9, 11))
    const minute = parseInt(dateStr.substring(11, 13))
    const second = parseInt(dateStr.substring(13, 15))
    return new Date(Date.UTC(year, month, day, hour, minute, second))
}
