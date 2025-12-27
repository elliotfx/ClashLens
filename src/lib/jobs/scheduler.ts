import cron from 'node-cron'
import { prisma } from '../db'
import { collectClanSnapshot } from './snapshot'
import { collectAllWarsData } from './war'
import { collectAllRankedData } from './ranked'
import { finalizeWeek } from './finalize'

// Map to store snapshot jobs per clan
const snapshotJobs = new Map<string, cron.ScheduledTask>()
let warJob: cron.ScheduledTask | null = null
let rankedJob: cron.ScheduledTask | null = null
let finalizeJob: cron.ScheduledTask | null = null

/**
 * Get CRON expression for a given frequency in minutes
 */
function getCronExpression(frequencyMinutes: number): string {
    if (frequencyMinutes === 60) {
        return '0 * * * *' // Every hour at minute 0
    } else if (frequencyMinutes === 30) {
        return '0,30 * * * *' // Every 30 minutes
    } else if (frequencyMinutes === 15) {
        return '0,15,30,45 * * * *' // Every 15 minutes
    } else if (frequencyMinutes === 120) {
        return '0 */2 * * *' // Every 2 hours
    } else if (frequencyMinutes === 360) {
        return '0 */6 * * *' // Every 6 hours
    } else {
        return '0 * * * *' // Default to hourly
    }
}

/**
 * Schedule snapshot collection for a specific clan
 */
function scheduleSnapshotForClan(clanId: string, clanTag: string, frequencyMinutes: number): void {
    // Stop existing job if any
    if (snapshotJobs.has(clanId)) {
        snapshotJobs.get(clanId)?.stop()
        snapshotJobs.delete(clanId)
    }

    const cronExpression = getCronExpression(frequencyMinutes)
    console.log(`[Scheduler] Scheduling snapshots for clan ${clanTag}: ${cronExpression} (every ${frequencyMinutes} min)`)

    const job = cron.schedule(cronExpression, async () => {
        console.log(`[Scheduler] Running scheduled snapshot for clan ${clanTag}`)
        try {
            await collectClanSnapshot(clanTag)
        } catch (error) {
            console.error(`[Scheduler] Error in snapshot job for ${clanTag}:`, error)
        }
    })

    snapshotJobs.set(clanId, job)
}

/**
 * Start all schedulers
 */
export async function startScheduler(): Promise<void> {
    console.log('[Scheduler] Starting CRON scheduler')

    // Load all clans and schedule their snapshots
    const clans = await prisma.clan.findMany({
        select: { id: true, tag: true, snapshotFrequency: true }
    })

    console.log(`[Scheduler] Found ${clans.length} clans to schedule`)

    for (const clan of clans) {
        const frequency = clan.snapshotFrequency || 60 // Default to 60 minutes
        scheduleSnapshotForClan(clan.id, clan.tag, frequency)
    }

    // War data collection (every 2 hours, global)
    console.log('[Scheduler] War data collection scheduled: 0 */2 * * *')
    warJob = cron.schedule('0 */2 * * *', async () => {
        console.log('[Scheduler] Running scheduled war data collection')
        try {
            await collectAllWarsData()
        } catch (error) {
            console.error('[Scheduler] Error in war job:', error)
        }
    })

    // Ranked data collection (every 4 hours, global)
    console.log('[Scheduler] Ranked data collection scheduled: 0 */4 * * *')
    rankedJob = cron.schedule('0 */4 * * *', async () => {
        console.log('[Scheduler] Running scheduled ranked data collection')
        try {
            await collectAllRankedData()
        } catch (error) {
            console.error('[Scheduler] Error in ranked job:', error)
        }
    })

    // Weekly finalization (Monday at 3 AM, global)
    console.log('[Scheduler] Weekly finalization scheduled: 0 3 * * 1')
    finalizeJob = cron.schedule('0 3 * * 1', async () => {
        console.log('[Scheduler] Running weekly finalization')
        try {
            await finalizeWeek()
        } catch (error) {
            console.error('[Scheduler] Error in finalize job:', error)
        }
    })

    console.log('[Scheduler] Scheduler started successfully')
}

/**
 * Stop all schedulers
 */
export function stopScheduler(): void {
    console.log('[Scheduler] Stopping CRON scheduler')

    // Stop all clan snapshot jobs
    for (const [clanId, job] of snapshotJobs.entries()) {
        job.stop()
        console.log(`[Scheduler] Stopped snapshot job for clan ${clanId}`)
    }
    snapshotJobs.clear()

    if (warJob) {
        warJob.stop()
        warJob = null
    }

    if (rankedJob) {
        rankedJob.stop()
        rankedJob = null
    }

    if (finalizeJob) {
        finalizeJob.stop()
        finalizeJob = null
    }

    console.log('[Scheduler] Scheduler stopped')
}

/**
 * Update snapshot schedule for a specific clan (called when settings change)
 */
export async function updateClanSchedule(clanId: string): Promise<void> {
    const clan = await prisma.clan.findUnique({
        where: { id: clanId },
        select: { tag: true, snapshotFrequency: true }
    })

    if (clan) {
        const frequency = clan.snapshotFrequency || 60
        scheduleSnapshotForClan(clanId, clan.tag, frequency)
        console.log(`[Scheduler] Updated schedule for clan ${clan.tag}`)
    }
}

/**
 * Run initial data collection (10 seconds after start)
 */
export function runInitialCollection(): void {
    setTimeout(async () => {
        console.log('[Scheduler] Running initial data collection')
        try {
            const clans = await prisma.clan.findMany({ select: { tag: true } })

            for (const clan of clans) {
                await collectClanSnapshot(clan.tag)
                await new Promise(resolve => setTimeout(resolve, 2000)) // Delay between clans
            }

            await collectAllWarsData()
            await new Promise(resolve => setTimeout(resolve, 5000))
            await collectAllRankedData()
            console.log('[Scheduler] Initial collection completed')
        } catch (error) {
            console.error('[Scheduler] Error in initial collection:', error)
        }
    }, 10000)
}
