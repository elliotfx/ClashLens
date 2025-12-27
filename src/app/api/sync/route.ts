import { NextRequest, NextResponse } from 'next/server'
import { collectAllClanSnapshots } from '@/lib/jobs/snapshot'
import { collectAllWarsData } from '@/lib/jobs/war'
import { collectAllRankedData } from '@/lib/jobs/ranked'

// This endpoint is for manual sync from the Settings page
// In production, you'd want to add authentication here
export async function POST(request: NextRequest) {
    try {
        // Start collection in background
        // Don't await - return immediately so UI doesn't hang
        Promise.all([
            collectAllClanSnapshots().catch(err => console.error('[Sync] Snapshot error:', err)),
            collectAllWarsData().catch(err => console.error('[Sync] War error:', err)),
            collectAllRankedData().catch(err => console.error('[Sync] Ranked error:', err)),
        ])

        return NextResponse.json({
            success: true,
            message: 'Sync started in background (snapshots, wars, ranked)',
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error('[API] Sync error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
