interface PlayerSnapshotData {
    timestamp: Date
    trophies: number
    donationsSent?: number
    attackWins?: number
}

interface WarParticipation {
    totalWars: number
    attacksUsed: number
    attacksAvailable: number
}

interface PlayerCurrentData {
    trophies: number
    donations: number
    donationsReceived: number
    townHallLevel: number
    expLevel: number
    role: string
    leagueTier?: string | null  // Ranked league tier
}

export interface IRJComponents {
    presenceScore: number
    trophyScore: number
    donationScore: number
    warScore: number
    totalScore: number
    details: {
        presence: {
            snapshotsWeek: number
            snapshotsMonth: number
            reason: string
        }
        trophy: {
            delta7d: number
            currentTrophies: number
            reason: string
        }
        donation: {
            donationsWeek: number
            reason: string
        }
        war: {
            source: string
            reason: string
        }
    }
}

/**
 * Calculate IRJ (Individual Reliability & Journey) score for a player
 * Score range: 0-100
 * 
 * Components:
 * - Presence consistency: 40% (based on snapshot frequency)
 * - Trophy delta (7 days): 30% (positive progression rewarded)
 * - Donations: 15% (contribution to clan)
 * - War participation: 15% (attacks used vs available)
 */
export function calculateIRJ(
    snapshots: PlayerSnapshotData[],
    warData?: WarParticipation,
    currentData?: PlayerCurrentData
): IRJComponents {
    const sorted = [...snapshots].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    // If no snapshots but have current data, use alternative calculation
    if (sorted.length < 2 && currentData) {
        return calculateIRJFromCurrentData(currentData)
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const weeklySnapshots = sorted.filter(s => s.timestamp >= sevenDaysAgo)
    const monthlySnapshots = sorted.filter(s => s.timestamp >= thirtyDaysAgo)

    // 1. Presence Score (0-40 points)
    const expectedWeekly = 42 // ~1 snapshot per 4 hours
    const weeklyScore = Math.min(1, weeklySnapshots.length / expectedWeekly)
    const monthlyScore = Math.min(1, monthlySnapshots.length / 252)
    const presenceScore = Math.round((weeklyScore * 0.7 + monthlyScore * 0.3) * 40)

    let presenceReason = ''
    if (weeklySnapshots.length === 0) presenceReason = 'Aucune activité récente'
    else if (presenceScore >= 35) presenceReason = 'Très actif (>80% de présence)'
    else if (presenceScore >= 25) presenceReason = 'Actif régulièrement'
    else if (presenceScore >= 15) presenceReason = 'Présence modérée'
    else presenceReason = 'Peu actif récemment'

    // 2. Trophy Score (0-30 points)
    let trophyDelta = 0
    let trophyScore = 15
    let trophyReason = ''
    let currentTrophies = 0

    if (weeklySnapshots.length >= 2) {
        const oldest = weeklySnapshots[0]
        const newest = weeklySnapshots[weeklySnapshots.length - 1]
        trophyDelta = newest.trophies - oldest.trophies
        currentTrophies = newest.trophies

        if (trophyDelta >= 200) { trophyScore = 30; trophyReason = `Excellente progression (+${trophyDelta} trophées)` }
        else if (trophyDelta >= 100) { trophyScore = 25; trophyReason = `Bonne progression (+${trophyDelta} trophées)` }
        else if (trophyDelta >= 50) { trophyScore = 22; trophyReason = `Progression correcte (+${trophyDelta} trophées)` }
        else if (trophyDelta >= 0) { trophyScore = 15 + Math.round((trophyDelta / 50) * 7); trophyReason = trophyDelta > 0 ? `Légère hausse (+${trophyDelta})` : 'Trophées stables' }
        else if (trophyDelta >= -50) { trophyScore = 15 + Math.round((trophyDelta / 50) * 15); trophyReason = `Légère baisse (${trophyDelta})` }
        else if (trophyDelta >= -100) { trophyScore = 7; trophyReason = `Perte de trophées (${trophyDelta})` }
        else if (trophyDelta >= -200) { trophyScore = 3; trophyReason = `Forte perte (${trophyDelta})` }
        else { trophyScore = 0; trophyReason = `Chute importante (${trophyDelta})` }
    } else {
        trophyReason = 'Pas assez de données (score neutre)'
    }

    // 3. Donation Score (0-15 points)
    let donationsWeek = 0
    let donationScore = 0
    let donationReason = ''

    if (weeklySnapshots.length >= 2) {
        const oldest = weeklySnapshots[0]
        const newest = weeklySnapshots[weeklySnapshots.length - 1]
        donationsWeek = (newest.donationsSent || 0) - (oldest.donationsSent || 0)

        if (donationsWeek >= 500) { donationScore = 15; donationReason = `Très généreux (${donationsWeek} dons)` }
        else if (donationsWeek >= 300) { donationScore = 12; donationReason = `Donateur actif (${donationsWeek} dons)` }
        else if (donationsWeek >= 150) { donationScore = 9; donationReason = `Contributions régulières (${donationsWeek})` }
        else if (donationsWeek >= 50) { donationScore = 6; donationReason = `Quelques dons (${donationsWeek})` }
        else if (donationsWeek > 0) { donationScore = 3; donationReason = `Peu de dons (${donationsWeek})` }
        else { donationScore = 0; donationReason = 'Aucun don cette semaine' }
    } else {
        donationReason = 'Pas de données de dons'
    }

    // 4. War Score (0-15 points)
    let warScore = 7.5
    let warSource = 'Données de guerre'
    let warReason = ''

    if (warData && warData.totalWars > 0) {
        const rate = warData.attacksUsed / warData.attacksAvailable
        warScore = Math.round(rate * 15)
        warSource = `${warData.attacksUsed}/${warData.attacksAvailable} attaques`
        if (rate >= 1) warReason = 'Participation parfaite'
        else if (rate >= 0.8) warReason = 'Excellente participation'
        else if (rate >= 0.5) warReason = 'Participation moyenne'
        else warReason = 'Participation faible'
    } else {
        warSource = 'Pas de données'
        warReason = 'Score par défaut (7.5)'
    }

    const totalScore = Math.round(presenceScore + trophyScore + donationScore + warScore)

    return {
        presenceScore: Math.round(presenceScore),
        trophyScore: Math.round(trophyScore),
        donationScore: Math.round(donationScore),
        warScore: Math.round(warScore),
        totalScore: Math.min(100, Math.max(0, totalScore)),
        details: {
            presence: {
                snapshotsWeek: weeklySnapshots.length,
                snapshotsMonth: monthlySnapshots.length,
                reason: presenceReason,
            },
            trophy: {
                delta7d: trophyDelta,
                currentTrophies,
                reason: trophyReason,
            },
            donation: {
                donationsWeek,
                reason: donationReason,
            },
            war: {
                source: warSource,
                reason: warReason,
            },
        },
    }
}

/**
 * Calculate IRJ from current player data when no historical snapshots exist
 */
function calculateIRJFromCurrentData(data: PlayerCurrentData): IRJComponents {
    // Trophy Score based on ranked league tier (not trophies - they reset weekly)
    let trophyScore = 15 // Neutral score if no ranked data
    let trophyReason = ''

    // If player has a ranked league tier, calculate score based on that
    if (data.leagueTier) {
        // Extract tier number from league name (e.g., "P.E.K.K.A League 22" -> 22)
        const tierMatch = data.leagueTier.match(/(\d+)$/)
        const tier = tierMatch ? parseInt(tierMatch[1]) : 0

        if (tier >= 22) { trophyScore = 30; trophyReason = `Top tier (${data.leagueTier})` }
        else if (tier >= 19) { trophyScore = 27; trophyReason = `Golem League (${data.leagueTier})` }
        else if (tier >= 16) { trophyScore = 24; trophyReason = `Witch League (${data.leagueTier})` }
        else if (tier >= 13) { trophyScore = 21; trophyReason = `Valkyrie League (${data.leagueTier})` }
        else if (tier >= 10) { trophyScore = 18; trophyReason = `Wizard League (${data.leagueTier})` }
        else if (tier >= 7) { trophyScore = 15; trophyReason = `Archer League (${data.leagueTier})` }
        else if (tier >= 4) { trophyScore = 12; trophyReason = `Barbarian League (${data.leagueTier})` }
        else if (tier >= 1) { trophyScore = 8; trophyReason = `Skeleton League (${data.leagueTier})` }
        else { trophyScore = 5; trophyReason = 'Non classé en ranked' }
    } else {
        trophyReason = 'Pas de données ranked'
    }

    // Donation Score
    let donationScore = 0
    let donationReason = ''
    if (data.donations >= 1000) { donationScore = 15; donationReason = `Top donateur (${data.donations})` }
    else if (data.donations >= 500) { donationScore = 12; donationReason = `Très généreux (${data.donations})` }
    else if (data.donations >= 200) { donationScore = 9; donationReason = `Bon donateur (${data.donations})` }
    else if (data.donations >= 100) { donationScore = 6; donationReason = `Dons réguliers (${data.donations})` }
    else if (data.donations >= 50) { donationScore = 4; donationReason = `Quelques dons (${data.donations})` }
    else if (data.donations > 0) { donationScore = 2; donationReason = `Peu de dons (${data.donations})` }
    else { donationReason = 'Aucun don' }

    // Presence Score from TH + Exp
    const thScore = Math.min(20, Math.max(0, data.townHallLevel * 1.5))
    const expScore = Math.min(20, data.expLevel / 10)
    const presenceScore = Math.round(thScore + expScore)
    const presenceReason = `TH${data.townHallLevel} + Niv.${data.expLevel}`

    // Role as war proxy
    let roleScore = 5
    let roleReason = ''
    if (data.role === 'leader') { roleScore = 15; roleReason = 'Leader du clan' }
    else if (data.role === 'coLeader') { roleScore = 12; roleReason = 'Co-leader' }
    else if (data.role === 'admin' || data.role === 'elder') { roleScore = 9; roleReason = 'Aîné' }
    else { roleReason = 'Membre' }

    const totalScore = Math.round(presenceScore + trophyScore + donationScore + roleScore)

    return {
        presenceScore,
        trophyScore,
        donationScore,
        warScore: roleScore,
        totalScore: Math.min(100, Math.max(0, totalScore)),
        details: {
            presence: {
                snapshotsWeek: 0,
                snapshotsMonth: 0,
                reason: presenceReason,
            },
            trophy: {
                delta7d: 0,
                currentTrophies: data.trophies,
                reason: trophyReason,
            },
            donation: {
                donationsWeek: data.donations,
                reason: donationReason,
            },
            war: {
                source: 'Rôle utilisé',
                reason: roleReason,
            },
        },
    }
}

/**
 * Get trophy delta for a player over the last N days
 */
export function getTrophyDelta(snapshots: PlayerSnapshotData[], days: number = 7): number {
    if (snapshots.length < 2) return 0

    const sorted = [...snapshots].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const now = new Date()
    const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    const recentSnapshots = sorted.filter(s => s.timestamp >= pastDate)
    if (recentSnapshots.length < 2) return 0

    const oldest = recentSnapshots[0]
    const newest = recentSnapshots[recentSnapshots.length - 1]

    return newest.trophies - oldest.trophies
}
