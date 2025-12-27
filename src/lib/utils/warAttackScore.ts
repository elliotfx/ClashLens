/**
 * War Attack Score (SPA) Calculator
 * Calculates performance score based on TH differential and stars obtained
 */

export interface AttackScoreResult {
    score: number
    category: 'climb' | 'level' | 'dip'  // montée / niveau / descente
    thDiff: number
    stars: number
    destruction: number
    rating: 'excellent' | 'good' | 'average' | 'poor' | 'fail'
}

/**
 * Scoring matrix based on TH differential and stars
 * Rows: TH diff (attacker - defender), Cols: stars (0, 1, 2, 3)
 */
const SCORE_MATRIX: { [thDiff: number]: number[] } = {
    // Climbing (positive = attacking higher TH)
    3: [30, 60, 90, 130],   // +3 HDV (very rare, big reward)
    2: [20, 50, 80, 120],   // +2 HDV
    1: [10, 40, 70, 100],   // +1 HDV

    // Level (attacking same TH)
    0: [-10, 20, 50, 80],   // Same HDV

    // Dipping (negative = attacking lower TH)
    [-1]: [-30, 0, 30, 60],  // -1 HDV
    [-2]: [-50, -20, 10, 40], // -2 HDV
    [-3]: [-70, -40, -10, 20], // -3 HDV (heavily penalized)
}

/**
 * Calculate attack performance score
 */
export function calculateAttackScore(
    attackerTH: number,
    defenderTH: number,
    stars: number,
    destructionPct: number = 0
): AttackScoreResult {
    // Clamp values
    const clampedStars = Math.max(0, Math.min(3, Math.round(stars)))
    const thDiff = defenderTH - attackerTH  // Positive = climbing

    // Determine category
    let category: 'climb' | 'level' | 'dip'
    if (thDiff >= 1) {
        category = 'climb'
    } else if (thDiff <= -1) {
        category = 'dip'
    } else {
        category = 'level'
    }

    // Get base score from matrix
    // Clamp thDiff to matrix range
    const matrixDiff = Math.max(-3, Math.min(3, thDiff))
    const scores = SCORE_MATRIX[matrixDiff] || SCORE_MATRIX[0]
    let score = scores[clampedStars]

    // Bonus for high destruction on 2-star (near 3-star)
    if (clampedStars === 2 && destructionPct >= 90) {
        score += 10  // Near-miss bonus
    }

    // Bonus for perfect 3-star with high climb
    if (clampedStars === 3 && thDiff >= 2) {
        score += 10  // Extra reward for impressive 3-star climb
    }

    // Determine rating
    let rating: 'excellent' | 'good' | 'average' | 'poor' | 'fail'
    if (score >= 100) {
        rating = 'excellent'
    } else if (score >= 70) {
        rating = 'good'
    } else if (score >= 40) {
        rating = 'average'
    } else if (score >= 0) {
        rating = 'poor'
    } else {
        rating = 'fail'
    }

    return {
        score,
        category,
        thDiff,
        stars: clampedStars,
        destruction: destructionPct,
        rating,
    }
}

/**
 * Calculate average score from multiple attacks
 */
export function calculateAverageScore(attacks: AttackScoreResult[]): number {
    if (attacks.length === 0) return 0
    const total = attacks.reduce((sum, a) => sum + a.score, 0)
    return Math.round(total / attacks.length)
}

/**
 * Get category stats from attacks
 */
export function getCategoryStats(attacks: AttackScoreResult[]): {
    climb: { count: number; avgScore: number; avgStars: number }
    level: { count: number; avgScore: number; avgStars: number }
    dip: { count: number; avgScore: number; avgStars: number }
} {
    const byCategory = {
        climb: attacks.filter(a => a.category === 'climb'),
        level: attacks.filter(a => a.category === 'level'),
        dip: attacks.filter(a => a.category === 'dip'),
    }

    const calcStats = (arr: AttackScoreResult[]) => ({
        count: arr.length,
        avgScore: arr.length ? Math.round(arr.reduce((s, a) => s + a.score, 0) / arr.length) : 0,
        avgStars: arr.length ? Math.round(arr.reduce((s, a) => s + a.stars, 0) / arr.length * 10) / 10 : 0,
    })

    return {
        climb: calcStats(byCategory.climb),
        level: calcStats(byCategory.level),
        dip: calcStats(byCategory.dip),
    }
}

/**
 * Get French label for category
 */
export function getCategoryLabel(category: 'climb' | 'level' | 'dip'): string {
    switch (category) {
        case 'climb': return 'Montée'
        case 'level': return 'Niveau'
        case 'dip': return 'Descente'
    }
}

/**
 * Get French label for rating
 */
export function getRatingLabel(rating: 'excellent' | 'good' | 'average' | 'poor' | 'fail'): string {
    switch (rating) {
        case 'excellent': return 'Excellent'
        case 'good': return 'Bon'
        case 'average': return 'Moyen'
        case 'poor': return 'Faible'
        case 'fail': return 'Échec'
    }
}

/**
 * Get color class for rating
 */
export function getRatingColor(rating: string): string {
    switch (rating) {
        case 'excellent': return 'text-green-400'
        case 'good': return 'text-blue-400'
        case 'average': return 'text-yellow-400'
        case 'poor': return 'text-orange-400'
        case 'fail': return 'text-red-400'
        default: return 'text-gray-400'
    }
}
