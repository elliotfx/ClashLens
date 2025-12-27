/**
 * League Reference System
 * Maps Town Hall levels to expected minimum ranked leagues
 * and provides utilities for calculating performance deltas
 * 
 * Official Reference from Supercell:
 * TH7 → Skeleton League 1
 * TH8 → Skeleton League 2
 * TH9 → Skeleton League 3
 * TH10 → Barbarian League 4
 * TH11 → Barbarian League 6
 * TH12 → Archer League 8
 * TH13 → Wizard League 11
 * TH14 → Valkyrie League 14
 * TH15 → Witch League 17
 * TH16 → Golem League 21
 * TH17 → Electro Titan League 25
 */

// Ranked league tiers (higher = better)
// Based on the official Clash of Clans ranked system (updated Dec 2024)
export const RANKED_LEAGUES = [
    { tier: 0, name: 'Unranked', shortName: 'N/A' },
    { tier: 1, name: 'Skeleton League 1', shortName: 'Skel 1' },
    { tier: 2, name: 'Skeleton League 2', shortName: 'Skel 2' },
    { tier: 3, name: 'Skeleton League 3', shortName: 'Skel 3' },
    { tier: 4, name: 'Barbarian League 4', shortName: 'Barb 4' },
    { tier: 5, name: 'Barbarian League 5', shortName: 'Barb 5' },
    { tier: 6, name: 'Barbarian League 6', shortName: 'Barb 6' },
    { tier: 7, name: 'Archer League 7', shortName: 'Arch 7' },
    { tier: 8, name: 'Archer League 8', shortName: 'Arch 8' },
    { tier: 9, name: 'Archer League 9', shortName: 'Arch 9' },
    { tier: 10, name: 'Wizard League 10', shortName: 'Wiz 10' },
    { tier: 11, name: 'Wizard League 11', shortName: 'Wiz 11' },
    { tier: 12, name: 'Wizard League 12', shortName: 'Wiz 12' },
    { tier: 13, name: 'Valkyrie League 13', shortName: 'Valk 13' },
    { tier: 14, name: 'Valkyrie League 14', shortName: 'Valk 14' },
    { tier: 15, name: 'Valkyrie League 15', shortName: 'Valk 15' },
    { tier: 16, name: 'Witch League 16', shortName: 'Witch 16' },
    { tier: 17, name: 'Witch League 17', shortName: 'Witch 17' },
    { tier: 18, name: 'Witch League 18', shortName: 'Witch 18' },
    { tier: 19, name: 'Golem League 19', shortName: 'Golem 19' },
    { tier: 20, name: 'Golem League 20', shortName: 'Golem 20' },
    { tier: 21, name: 'Golem League 21', shortName: 'Golem 21' },
    // P.E.K.K.A Leagues (top tier) - updated Dec 2024
    { tier: 22, name: 'P.E.K.K.A League 22', shortName: 'PEKKA 22' },
    { tier: 23, name: 'P.E.K.K.A League 23', shortName: 'PEKKA 23' },
    { tier: 24, name: 'P.E.K.K.A League 24', shortName: 'PEKKA 24' },
    { tier: 25, name: 'P.E.K.K.A League 25', shortName: 'PEKKA 25' },
] as const

// Minimum expected league tier for each Town Hall level
// Based on official Supercell reference
export const DEFAULT_TH_LEAGUE_REFERENCE: { [thLevel: number]: number } = {
    1: 0,   // No ranked expectation
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 1,   // Skeleton League 1
    8: 2,   // Skeleton League 2
    9: 3,   // Skeleton League 3
    10: 4,  // Barbarian League 4
    11: 6,  // Barbarian League 6
    12: 8,  // Archer League 8
    13: 11, // Wizard League 11
    14: 14, // Valkyrie League 14
    15: 17, // Witch League 17
    16: 21, // Golem League 21
    17: 25, // Electro Titan League 25
}

// Current reference (can be customized)
export let TH_LEAGUE_REFERENCE: { [thLevel: number]: number } = { ...DEFAULT_TH_LEAGUE_REFERENCE }

const STORAGE_KEY = 'clashlens_th_league_reference'

/**
 * Load custom TH league reference from localStorage
 */
export function loadCustomThLeagueReference(): { [thLevel: number]: number } {
    if (typeof window === 'undefined') return { ...DEFAULT_TH_LEAGUE_REFERENCE }

    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            TH_LEAGUE_REFERENCE = { ...DEFAULT_TH_LEAGUE_REFERENCE, ...parsed }
            return TH_LEAGUE_REFERENCE
        }
    } catch (e) {
        console.error('Failed to load custom TH league reference:', e)
    }
    return { ...DEFAULT_TH_LEAGUE_REFERENCE }
}

/**
 * Save custom TH league reference to localStorage
 */
export function saveCustomThLeagueReference(reference: { [thLevel: number]: number }): void {
    if (typeof window === 'undefined') return

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reference))
        TH_LEAGUE_REFERENCE = { ...reference }
    } catch (e) {
        console.error('Failed to save custom TH league reference:', e)
    }
}

/**
 * Reset TH league reference to defaults
 */
export function resetThLeagueReference(): { [thLevel: number]: number } {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY)
    }
    TH_LEAGUE_REFERENCE = { ...DEFAULT_TH_LEAGUE_REFERENCE }
    return TH_LEAGUE_REFERENCE
}

/**
 * Get league tier from league name
 * Handles various formats from the API
 */
export function getLeagueTier(leagueName: string | null | undefined): number {
    if (!leagueName) return 0

    // Try exact match first
    const exactMatch = RANKED_LEAGUES.find(l => l.name === leagueName)
    if (exactMatch) return exactMatch.tier

    // Try to extract the number from league name (e.g., "Barbarian League 4" -> 4)
    const match = leagueName.match(/(\d+)/)
    if (match) {
        const tier = parseInt(match[1], 10)
        if (tier >= 1 && tier <= 25) return tier
    }

    return 0
}

/**
 * Get league name from tier
 */
export function getLeagueName(tier: number): string {
    const league = RANKED_LEAGUES.find(l => l.tier === tier)
    return league?.name ?? 'Unranked'
}

/**
 * Get league short name from tier
 */
export function getLeagueShortName(tier: number): string {
    const league = RANKED_LEAGUES.find(l => l.tier === tier)
    return league?.shortName ?? 'N/A'
}

/**
 * Get expected minimum league tier for a Town Hall level
 */
export function getExpectedLeagueTier(thLevel: number): number {
    return TH_LEAGUE_REFERENCE[thLevel] ?? 0
}

/**
 * Get expected league name for a Town Hall level
 */
export function getExpectedLeagueName(thLevel: number): string {
    const tier = getExpectedLeagueTier(thLevel)
    return getLeagueName(tier)
}

export type PerformanceCategory = 'overperformer' | 'on-target' | 'underperformer' | 'unranked'

export interface LeaguePerformance {
    currentLeague: string
    currentTier: number
    expectedLeague: string
    expectedTier: number
    leagueDelta: number // Positive = above expected, Negative = below
    category: PerformanceCategory
}

/**
 * Calculate league performance for a player
 */
export function calculateLeaguePerformance(
    rankedLeague: string | null | undefined,
    townHallLevel: number
): LeaguePerformance {
    const currentTier = getLeagueTier(rankedLeague)
    const expectedTier = getExpectedLeagueTier(townHallLevel)
    const leagueDelta = currentTier - expectedTier

    let category: PerformanceCategory
    if (currentTier === 0) {
        category = 'unranked'
    } else if (leagueDelta >= 2) {
        category = 'overperformer'
    } else if (leagueDelta <= -2) {
        category = 'underperformer'
    } else {
        category = 'on-target' // Within ±1 league
    }

    return {
        currentLeague: getLeagueName(currentTier),
        currentTier,
        expectedLeague: getLeagueName(expectedTier),
        expectedTier,
        leagueDelta,
        category,
    }
}

/**
 * Get performance category label in French
 */
export function getCategoryLabel(category: PerformanceCategory): string {
    const labels: { [key in PerformanceCategory]: string } = {
        overperformer: 'Surperformant',
        'on-target': 'Conforme',
        underperformer: 'Sous-performant',
        unranked: 'Non classé',
    }
    return labels[category]
}

/**
 * Get performance category color
 */
export function getCategoryColor(category: PerformanceCategory): string {
    const colors: { [key in PerformanceCategory]: string } = {
        overperformer: 'text-green-400',
        'on-target': 'text-yellow-400',
        underperformer: 'text-red-400',
        unranked: 'text-gray-400',
    }
    return colors[category]
}

/**
 * Get performance category badge color
 */
export function getCategoryBadgeColor(category: PerformanceCategory): string {
    const colors: { [key in PerformanceCategory]: string } = {
        overperformer: 'bg-green-500/20 text-green-400 border-green-500/30',
        'on-target': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        underperformer: 'bg-red-500/20 text-red-400 border-red-500/30',
        unranked: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    }
    return colors[category]
}

/**
 * Format league delta for display
 */
export function formatLeagueDelta(delta: number): string {
    if (delta > 0) return `+${delta}`
    if (delta < 0) return `${delta}`
    return '0'
}
