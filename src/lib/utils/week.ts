import { format, startOfWeek, endOfWeek, getISOWeek, getYear, isSunday, subWeeks } from 'date-fns'

/**
 * Get ISO week ID in format "YYYY-WXX"
 * Example: "2025-W01" for the first week of 2025
 */
export function getWeekId(date: Date = new Date()): string {
    const year = getYear(date)
    const week = getISOWeek(date)
    return `${year}-W${week.toString().padStart(2, '0')}`
}

/**
 * Get the previous week ID
 */
export function getPreviousWeekId(date: Date = new Date()): string {
    return getWeekId(subWeeks(date, 1))
}

/**
 * Get start of current ISO week (Monday)
 */
export function getWeekStart(date: Date = new Date()): Date {
    return startOfWeek(date, { weekStartsOn: 1 }) // Monday
}

/**
 * Get end of current ISO week (Sunday)
 */
export function getWeekEnd(date: Date = new Date()): Date {
    return endOfWeek(date, { weekStartsOn: 1 }) // Monday start means Sunday end
}

/**
 * Check if a date is Sunday
 */
export function isDateSunday(date: Date): boolean {
    return isSunday(date)
}

/**
 * Get date string in YYYY-MM-DD format
 */
export function getDateString(date: Date = new Date()): string {
    return format(date, 'yyyy-MM-dd')
}

/**
 * Parse week ID to get year and week number
 */
export function parseWeekId(weekId: string): { year: number; week: number } {
    const match = weekId.match(/^(\d{4})-W(\d{2})$/)
    if (!match) {
        throw new Error(`Invalid week ID format: ${weekId}`)
    }
    return {
        year: parseInt(match[1], 10),
        week: parseInt(match[2], 10),
    }
}

/**
 * Compare two week IDs, returns -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareWeekIds(a: string, b: string): number {
    const parsedA = parseWeekId(a)
    const parsedB = parseWeekId(b)

    if (parsedA.year !== parsedB.year) {
        return parsedA.year - parsedB.year
    }
    return parsedA.week - parsedB.week
}

/**
 * Get ranked league tier from league name
 * Returns a number for sorting (higher = better)
 */
export function getRankedLeagueTier(league: string | null | undefined): number {
    if (!league) return 0

    const tiers: { [key: string]: number } = {
        'Bronze III': 1,
        'Bronze II': 2,
        'Bronze I': 3,
        'Silver III': 4,
        'Silver II': 5,
        'Silver I': 6,
        'Gold III': 7,
        'Gold II': 8,
        'Gold I': 9,
        'Crystal III': 10,
        'Crystal II': 11,
        'Crystal I': 12,
        'Master III': 13,
        'Master II': 14,
        'Master I': 15,
        'Champion III': 16,
        'Champion II': 17,
        'Champion I': 18,
        'Titan III': 19,
        'Titan II': 20,
        'Titan I': 21,
        'Legend League': 22,
    }

    return tiers[league] || 0
}
