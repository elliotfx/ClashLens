import cron from 'node-cron'
import { collectAllClanSnapshots } from './snapshot'
import { collectAllWarsData } from './war'
import { collectAllRankedData } from './ranked'
import { finalizeWeek } from './finalize'

let snapshotJob: cron.ScheduledTask | null = null
let warJob: cron.ScheduledTask | null = null
let rankedJob: cron.ScheduledTask | null = null
let finalizeJob: cron.ScheduledTask | null = null

export function startScheduler(): void {
    console.log('[Scheduler] Starting CRON scheduler')

    const snapshotFrequency = parseInt(process.env.SNAPSHOT_FREQUENCY_MINUTES || '60', 10)

    let snapshotCron: string
    if (snapshotFrequency === 60) {
        snapshotCron = '0 * * * *'
    } else if (snapshotFrequency === 30) {
        snapshotCron = '0,30 * * * *'
    } else if (snapshotFrequency === 15) {
        snapshotCron = '0,15,30,45 * * * *'
    } else {
        snapshotCron = '0 * * * *'
    }

    console.log('[Scheduler] Snapshot collection scheduled: ' + snapshotCron)

    snapshotJob = cron.schedule(snapshotCron, async () => {
        console.log('[Scheduler] Running scheduled snapshot collection')
        try {
            await collectAllClanSnapshots()
        } catch (error) {
            console.error('[Scheduler] Error in snapshot job:', error)
        }
    })

    console.log('[Scheduler] War data collection scheduled: 0 */2 * * *')
    warJob = cron.schedule('0 */2 * * *', async () => {
        console.log('[Scheduler] Running scheduled war data collection')
        try {
            await collectAllWarsData()
        } catch (error) {
            console.error('[Scheduler] Error in war job:', error)
        }
    })

    console.log('[Scheduler] Ranked data collection scheduled: 0 */4 * * *')
    rankedJob = cron.schedule('0 */4 * * *', async () => {
        console.log('[Scheduler] Running scheduled ranked data collection')
        try {
            await collectAllRankedData()
        } catch (error) {
            console.error('[Scheduler] Error in ranked job:', error)
        }
    })

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

export function stopScheduler(): void {
    console.log('[Scheduler] Stopping CRON scheduler')

    if (snapshotJob) {
        snapshotJob.stop()
        snapshotJob = null
    }

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

export function runInitialCollection(): void {
    setTimeout(async () => {
        console.log('[Scheduler] Running initial data collection')
        try {
            await collectAllClanSnapshots()
            await new Promise(resolve => setTimeout(resolve, 5000))
            await collectAllWarsData()
            await new Promise(resolve => setTimeout(resolve, 5000))
            await collectAllRankedData()
            console.log('[Scheduler] Initial collection completed')
        } catch (error) {
            console.error('[Scheduler] Error in initial collection:', error)
        }
    }, 10000)
}
