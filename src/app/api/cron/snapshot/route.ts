import { NextRequest, NextResponse } from 'next/server'
import { collectAllClanSnapshots } from '@/lib/jobs/snapshot'

export async function POST(request: NextRequest) {
    try {
        // Verify CRON secret
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret) {
            return NextResponse.json(
                { error: 'CRON_SECRET not configured' },
                { status: 500 }
            )
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Run snapshot collection
        await collectAllClanSnapshots()

        return NextResponse.json({
            success: true,
            message: 'Snapshot collection completed',
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error('[CRON] Snapshot collection error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
