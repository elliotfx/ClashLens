import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface PlayerStats {
    tag: string
    name: string
    totalAttacks: number
    totalStars: number
    avgStars: number
    avgDestruction: number
    avgScore: number
    threeStarRate: number
    twoStarRate: number
    oneStarRate: number
    zeroStarRate: number
    climbAttacks: number
    climbAvgScore: number
    levelAttacks: number
    levelAvgScore: number
    dipAttacks: number
    dipAvgScore: number
    excellentCount: number
    goodCount: number
    averageCount: number
    poorCount: number
    failCount: number
    warsParticipated: number
    missedAttacks: number
    attackEfficiency: number
}

export async function GET(
    request: NextRequest,
    { params }: { params: { clanTag: string } }
) {
    try {
        const clanTag = decodeURIComponent(params.clanTag)

        // Get clan from DB
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag },
            include: {
                wars: {
                    where: { state: 'warEnded' },
                    select: { id: true, teamSize: true, attacksPerMember: true },
                    orderBy: { endTime: 'desc' },
                },
            },
        })

        if (!clan) {
            return NextResponse.json({ error: 'Clan not found' }, { status: 404 })
        }

        const warIds = clan.wars.map(w => w.id)

        if (warIds.length === 0) {
            return NextResponse.json({
                totalWars: 0,
                playerStats: [],
                topPerformers: [],
                needsImprovement: [],
                clanAverages: null,
            })
        }

        // Get all attacks for these wars
        const attacks = await prisma.warAttack.findMany({
            where: { warId: { in: warIds } },
        })

        // Group attacks by player
        const playerMap = new Map<string, {
            name: string
            attacks: typeof attacks
            warsParticipated: Set<string>
        }>()

        attacks.forEach(attack => {
            if (!playerMap.has(attack.attackerTag)) {
                playerMap.set(attack.attackerTag, {
                    name: attack.attackerName || 'Unknown',
                    attacks: [],
                    warsParticipated: new Set(),
                })
            }
            const player = playerMap.get(attack.attackerTag)!
            player.attacks.push(attack)
            player.warsParticipated.add(attack.warId)
        })

        // Calculate stats for each player
        const playerStats: PlayerStats[] = []

        playerMap.forEach((data, tag) => {
            const atks = data.attacks
            const totalAttacks = atks.length
            const totalStars = atks.reduce((sum, a) => sum + a.stars, 0)
            const avgStars = totalAttacks > 0 ? Math.round((totalStars / totalAttacks) * 100) / 100 : 0
            const avgDestruction = totalAttacks > 0
                ? Math.round(atks.reduce((sum, a) => sum + a.destructionPct, 0) / totalAttacks * 10) / 10
                : 0
            const avgScore = totalAttacks > 0
                ? Math.round(atks.reduce((sum, a) => sum + a.attackScore, 0) / totalAttacks)
                : 0

            const threeStars = atks.filter(a => a.stars === 3).length
            const twoStars = atks.filter(a => a.stars === 2).length
            const oneStars = atks.filter(a => a.stars === 1).length
            const zeroStars = atks.filter(a => a.stars === 0).length

            const climbAtks = atks.filter(a => a.category === 'climb')
            const levelAtks = atks.filter(a => a.category === 'level')
            const dipAtks = atks.filter(a => a.category === 'dip')

            const excellentCount = atks.filter(a => a.rating === 'excellent').length
            const goodCount = atks.filter(a => a.rating === 'good').length
            const averageCount = atks.filter(a => a.rating === 'average').length
            const poorCount = atks.filter(a => a.rating === 'poor').length
            const failCount = atks.filter(a => a.rating === 'fail').length

            // Calculate missed attacks (assuming 2 attacks per war)
            const warsCount = data.warsParticipated.size
            const expectedAttacks = warsCount * 2
            const missedAttacks = Math.max(0, expectedAttacks - totalAttacks)
            const attackEfficiency = expectedAttacks > 0
                ? Math.round((totalAttacks / expectedAttacks) * 100)
                : 100

            playerStats.push({
                tag,
                name: data.name,
                totalAttacks,
                totalStars,
                avgStars,
                avgDestruction,
                avgScore,
                threeStarRate: totalAttacks > 0 ? Math.round((threeStars / totalAttacks) * 100) : 0,
                twoStarRate: totalAttacks > 0 ? Math.round((twoStars / totalAttacks) * 100) : 0,
                oneStarRate: totalAttacks > 0 ? Math.round((oneStars / totalAttacks) * 100) : 0,
                zeroStarRate: totalAttacks > 0 ? Math.round((zeroStars / totalAttacks) * 100) : 0,
                climbAttacks: climbAtks.length,
                climbAvgScore: climbAtks.length > 0
                    ? Math.round(climbAtks.reduce((s, a) => s + a.attackScore, 0) / climbAtks.length)
                    : 0,
                levelAttacks: levelAtks.length,
                levelAvgScore: levelAtks.length > 0
                    ? Math.round(levelAtks.reduce((s, a) => s + a.attackScore, 0) / levelAtks.length)
                    : 0,
                dipAttacks: dipAtks.length,
                dipAvgScore: dipAtks.length > 0
                    ? Math.round(dipAtks.reduce((s, a) => s + a.attackScore, 0) / dipAtks.length)
                    : 0,
                excellentCount,
                goodCount,
                averageCount,
                poorCount,
                failCount,
                warsParticipated: warsCount,
                missedAttacks,
                attackEfficiency,
            })
        })

        // Sort by average score descending
        playerStats.sort((a, b) => b.avgScore - a.avgScore)

        // Top performers (top 5 by score with at least 4 attacks)
        const topPerformers = playerStats
            .filter(p => p.totalAttacks >= 4)
            .slice(0, 5)
            .map(p => ({
                tag: p.tag,
                name: p.name,
                avgScore: p.avgScore,
                avgStars: p.avgStars,
                threeStarRate: p.threeStarRate,
                totalAttacks: p.totalAttacks,
            }))

        // Needs improvement (bottom 5 by score with at least 4 attacks)
        const needsImprovement = playerStats
            .filter(p => p.totalAttacks >= 4)
            .slice(-5)
            .reverse()
            .map(p => ({
                tag: p.tag,
                name: p.name,
                avgScore: p.avgScore,
                avgStars: p.avgStars,
                threeStarRate: p.threeStarRate,
                totalAttacks: p.totalAttacks,
                missedAttacks: p.missedAttacks,
            }))

        // Clan averages
        const totalClanAttacks = playerStats.reduce((s, p) => s + p.totalAttacks, 0)
        const clanAverages = {
            avgScore: totalClanAttacks > 0
                ? Math.round(playerStats.reduce((s, p) => s + p.avgScore * p.totalAttacks, 0) / totalClanAttacks)
                : 0,
            avgStars: totalClanAttacks > 0
                ? Math.round(playerStats.reduce((s, p) => s + p.avgStars * p.totalAttacks, 0) / totalClanAttacks * 100) / 100
                : 0,
            threeStarRate: totalClanAttacks > 0
                ? Math.round(playerStats.reduce((s, p) => s + (p.threeStarRate * p.totalAttacks / 100), 0) / totalClanAttacks * 100)
                : 0,
            avgAttackEfficiency: playerStats.length > 0
                ? Math.round(playerStats.reduce((s, p) => s + p.attackEfficiency, 0) / playerStats.length)
                : 100,
        }

        return NextResponse.json({
            totalWars: clan.wars.length,
            totalAttacks: totalClanAttacks,
            playerStats,
            topPerformers,
            needsImprovement,
            clanAverages,
        })
    } catch (error) {
        console.error('[API] Player war stats error:', error)
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }
}
