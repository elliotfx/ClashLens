/**
 * Ranked Battles League Hierarchy (October 2025 Update)
 * 
 * Leagues from lowest to highest:
 * Skeleton → Barbarian → Archer → Wizard → Valkyrie → Witch → Golem → P.E.K.K.A → Titan → Dragon → Electro → Legend
 * 
 * Each league (except Legend) has divisions 1-3 or more (e.g., P.E.K.K.A 1-24)
 * Higher division number = higher rank within that league
 */

// Base leagues in order from lowest to highest
const RANKED_LEAGUES_ORDER = [
    'Skeleton',
    'Barbarian',
    'Archer',
    'Wizard',
    'Valkyrie',
    'Witch',
    'Golem',
    'P.E.K.K.A',
    'PEKKA',       // Alternative spelling
    'Titan',
    'Dragon',
    'Electro',
    'Legend',
] as const

// Map league base name to tier number (higher = better)
const LEAGUE_BASE_TIERS: { [key: string]: number } = {
    'Skeleton': 100,
    'Barbarian': 200,
    'Archer': 300,
    'Wizard': 400,
    'Valkyrie': 500,
    'Witch': 600,
    'Golem': 700,
    'P.E.K.K.A': 800,
    'PEKKA': 800,
    'Titan': 900,
    'Dragon': 1000,
    'Electro': 1100,
    'Legend': 1200,
}

/**
 * Parse a ranked league name like "P.E.K.K.A League 22" into components
 */
export function parseRankedLeague(leagueName: string | null | undefined): {
    baseName: string
    division: number
    fullName: string
} | null {
    if (!leagueName) return null

    // Pattern: "LeagueName League Division" or "LeagueName Division"
    // Examples: "P.E.K.K.A League 22", "Skeleton League 1", "Legend League"

    const patterns = [
        /^(.+?)\s+League\s+(\d+)$/i,      // "P.E.K.K.A League 22"
        /^(.+?)\s+(\d+)$/i,                // "Skeleton 1"
        /^(.+?)\s+League$/i,               // "Legend League" (no division)
        /^(.+?)$/,                          // Just the name
    ]

    for (const pattern of patterns) {
        const match = leagueName.match(pattern)
        if (match) {
            const baseName = match[1].trim()
            const division = match[2] ? parseInt(match[2], 10) : 1
            return {
                baseName,
                division,
                fullName: leagueName,
            }
        }
    }

    return null
}

/**
 * Get numeric tier for a ranked league (higher = better)
 * Used for sorting players by league rank
 */
export function getRankedLeagueTier(leagueName: string | null | undefined): number {
    if (!leagueName) return 0

    const parsed = parseRankedLeague(leagueName)
    if (!parsed) return 0

    // Find base tier
    let baseTier = 0
    for (const [key, tier] of Object.entries(LEAGUE_BASE_TIERS)) {
        if (parsed.baseName.toLowerCase().includes(key.toLowerCase())) {
            baseTier = tier
            break
        }
    }

    // Add division to tier (division 22 > division 1 within same league)
    return baseTier + parsed.division
}

/**
 * Compare two ranked leagues
 * Returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareRankedLeagues(a: string | null | undefined, b: string | null | undefined): number {
    const tierA = getRankedLeagueTier(a)
    const tierB = getRankedLeagueTier(b)
    return tierA - tierB
}

/**
 * Get league display info (for UI)
 */
export function getLeagueDisplayInfo(leagueName: string | null | undefined): {
    name: string
    shortName: string
    tier: number
    color: string
} {
    if (!leagueName) {
        return { name: 'Unranked', shortName: 'N/A', tier: 0, color: '#6B7280' }
    }

    const parsed = parseRankedLeague(leagueName)
    const tier = getRankedLeagueTier(leagueName)

    // Colors for each league
    const colors: { [key: string]: string } = {
        'Skeleton': '#9CA3AF',     // Gray
        'Barbarian': '#F59E0B',    // Amber
        'Archer': '#10B981',       // Emerald
        'Wizard': '#8B5CF6',       // Violet
        'Valkyrie': '#EC4899',     // Pink
        'Witch': '#6366F1',        // Indigo
        'Golem': '#78716C',        // Stone
        'P.E.K.K.A': '#3B82F6',    // Blue
        'PEKKA': '#3B82F6',
        'Titan': '#F43F5E',        // Rose
        'Dragon': '#EF4444',       // Red
        'Electro': '#06B6D4',      // Cyan
        'Legend': '#EAB308',       // Yellow/Gold
    }

    let color = '#6B7280'
    let shortName = leagueName

    if (parsed) {
        for (const [key, c] of Object.entries(colors)) {
            if (parsed.baseName.toLowerCase().includes(key.toLowerCase())) {
                color = c
                break
            }
        }
        shortName = parsed.division > 1
            ? `${parsed.baseName} ${parsed.division}`
            : parsed.baseName
    }

    return {
        name: leagueName,
        shortName,
        tier,
        color,
    }
}

/**
 * Sort players by ranked league (highest first)
 */
export function sortPlayersByLeague<T extends { league?: string | null }>(
    players: T[],
    order: 'asc' | 'desc' = 'desc'
): T[] {
    return [...players].sort((a, b) => {
        const comparison = compareRankedLeagues(a.league, b.league)
        return order === 'desc' ? -comparison : comparison
    })
}

/**
 * Get all leagues in order (for filters/dropdowns)
 */
export function getAllLeaguesInOrder(): string[] {
    return [...RANKED_LEAGUES_ORDER]
}
