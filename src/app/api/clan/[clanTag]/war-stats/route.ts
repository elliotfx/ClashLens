import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cocClient } from '@/lib/coc/client'
import { getCategoryStats, calculateAverageScore } from '@/lib/utils/warAttackScore'

export async function GET(
    request: NextRequest,
    { params }: { params: { clanTag: string } }
) {
    try {
        const clanTag = cocClient.normalizeTag(params.clanTag)

        // Get clan
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
        })

        if (!clan) {
            return NextResponse.json(
                { error: 'Clan not found' },
                { status: 404 }
            )
        }

        // Get all wars with attacks
        const wars = await prisma.war.findMany({
            where: { clanId: clan.id },
            include: {
                attacks: true,
            },
            orderBy: { startTime: 'desc' },
        })

        // Flatten all attacks
        const allAttacks = wars.flatMap(w => w.attacks)
        const totalAttacks = allAttacks.length
        const totalWars = wars.length

        if (totalAttacks === 0) {
            return NextResponse.json({
                clan: { tag: clanTag, name: clan.name },
                totalWars,
                totalAttacks: 0,
                avgScore: 0,
                categoryStats: {
                    climb: { count: 0, avgScore: 0, avgStars: 0 },
                    level: { count: 0, avgScore: 0, avgStars: 0 },
                    dip: { count: 0, avgScore: 0, avgStars: 0 },
                },
                topClimbers: [],
                needsHelp: [],
                playerStats: [],
            })
        }

        // Calculate category stats
        const attackResults = allAttacks.map(a => ({
            score: a.attackScore,
            category: a.category as 'climb' | 'level' | 'dip',
            thDiff: a.thDiff,
            stars: a.stars,
            destruction: a.destructionPct,
            rating: a.rating as 'excellent' | 'good' | 'average' | 'poor' | 'fail',
        }))

        const categoryStats = getCategoryStats(attackResults)
        const avgScore = calculateAverageScore(attackResults)

        // Group attacks by player
        const playerAttacks: Map<string, typeof allAttacks> = new Map()
        allAttacks.forEach(attack => {
            const existing = playerAttacks.get(attack.attackerTag) || []
            existing.push(attack)
            playerAttacks.set(attack.attackerTag, existing)
        })

        // Calculate per-player stats
        const playerStats = Array.from(playerAttacks.entries()).map(([tag, attacks]) => {
            const playerName = attacks[0]?.attackerName || tag
            const avgPlayerScore = Math.round(
                attacks.reduce((sum, a) => sum + a.attackScore, 0) / attacks.length
            )
            const avgStars = Math.round(
                attacks.reduce((sum, a) => sum + a.stars, 0) / attacks.length * 10
            ) / 10

            const climbAttacks = attacks.filter(a => a.category === 'climb')
            const levelAttacks = attacks.filter(a => a.category === 'level')
            const dipAttacks = attacks.filter(a => a.category === 'dip')

            return {
                tag,
                name: playerName,
                totalAttacks: attacks.length,
                avgScore: avgPlayerScore,
                avgStars,
                climb: {
                    count: climbAttacks.length,
                    avgScore: climbAttacks.length
                        ? Math.round(climbAttacks.reduce((s, a) => s + a.attackScore, 0) / climbAttacks.length)
                        : 0,
                },
                level: {
                    count: levelAttacks.length,
                    avgScore: levelAttacks.length
                        ? Math.round(levelAttacks.reduce((s, a) => s + a.attackScore, 0) / levelAttacks.length)
                        : 0,
                },
                dip: {
                    count: dipAttacks.length,
                    avgScore: dipAttacks.length
                        ? Math.round(dipAttacks.reduce((s, a) => s + a.attackScore, 0) / dipAttacks.length)
                        : 0,
                },
            }
        }).sort((a, b) => b.avgScore - a.avgScore)

        // Top climbers (best at attacking higher TH)
        const topClimbers = playerStats
            .filter(p => p.climb.count >= 2)
            .sort((a, b) => b.climb.avgScore - a.climb.avgScore)
            .slice(0, 5)

        // Needs help (poor performance on dips)
        const needsHelp = playerStats
            .filter(p => p.dip.count >= 2 && p.dip.avgScore < 40)
            .sort((a, b) => a.dip.avgScore - b.dip.avgScore)
            .slice(0, 5)

        return NextResponse.json({
            clan: { tag: clanTag, name: clan.name },
            totalWars,
            totalAttacks,
            avgScore,
            categoryStats,
            topClimbers,
            needsHelp,
            playerStats,
        })
    } catch (error) {
        console.error('[API] War stats error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch war stats' },
            { status: 500 }
        )
    }
}
