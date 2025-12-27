import { NextRequest, NextResponse } from 'next/server'

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

        // Note: Daily notifications are handled by the Discord bot
        // This endpoint is a placeholder for external CRON triggers
        console.log('[CRON] Daily notification trigger received')

        return NextResponse.json({
            success: true,
            message: 'Notification trigger received',
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error('[CRON] Notification error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
