import { EmbedBuilder, TextChannel } from 'discord.js'
import { prisma } from '../lib/db'
import { calculateIRJ, getTrophyDelta } from '../lib/utils/irj'

export async function sendDailyNotifications(client: any) {
    console.log('[Notifications] Starting daily notifications')

    try {
        // Get all Discord configurations
        const configs = await prisma.discordConfig.findMany({
            where: { notificationEnabled: true },
            include: { clan: true },
        })

        console.log(`[Notifications] Found ${configs.length} guilds with notifications enabled`)

        for (const config of configs) {
            try {
                if (!config.notificationChannelId) continue

                const channel = await client.channels.fetch(config.notificationChannelId)
                if (!channel || !(channel instanceof TextChannel)) continue

                // Get players with snapshots
                const players = await prisma.player.findMany({
                    where: { clanId: config.clan.id },
                    include: {
                        snapshots: {
                            orderBy: { timestamp: 'desc' },
                            take: 100,
                        },
                    },
                })

                // Calculate IRJ and deltas
                const playersWithStats = players.map(player => {
                    const irj = calculateIRJ(
                        player.snapshots.map(s => ({
                            timestamp: s.timestamp,
                            trophies: s.trophies,
                            donationsSent: s.donationsSent || undefined,
                            attackWins: s.attackWins || undefined,
                        }))
                    )

                    const trophyDelta7d = getTrophyDelta(
                        player.snapshots.map(s => ({
                            timestamp: s.timestamp,
                            trophies: s.trophies,
                        })),
                        7
                    )

                    return { player, irj: irj.totalScore, trophyDelta7d }
                })

                // Top performers
                const topIRJ = playersWithStats.sort((a, b) => b.irj - a.irj).slice(0, 5)
                const topGainers = playersWithStats.sort((a, b) => b.trophyDelta7d - a.trophyDelta7d).slice(0, 5)

                // Inactives
                const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                const inactivePlayers = players.filter(
                    p => !p.snapshots[0] || p.snapshots[0].timestamp < threeDaysAgo
                )

                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle(`☀️ Daily Summary - ${config.clan.name}`)
                    .setDescription('Here\'s your clan\'s performance over the last 7 days')
                    .addFields(
                        {
                            name: '🏆 Top Performers (IRJ)',
                            value: topIRJ
                                .map((p, i) => `${i + 1}. ${p.player.name} - **${p.irj}**/100`)
                                .join('\n') || 'No data',
                            inline: false,
                        },
                        {
                            name: '📈 Trophy Leaders',
                            value: topGainers
                                .map((p, i) => `${i + 1}. ${p.player.name} - **+${p.trophyDelta7d}**`)
                                .join('\n') || 'No data',
                            inline: false,
                        }
                    )
                    .setTimestamp()

                if (inactivePlayers.length > 0) {
                    embed.addFields({
                        name: '⚠️ Inactive Alert',
                        value: `${inactivePlayers.length} member(s) inactive for 3+ days`,
                        inline: false,
                    })
                }

                await channel.send({ embeds: [embed] })
                console.log(`[Notifications] Sent notification to guild ${config.guildId}`)
            } catch (error) {
                console.error(`[Notifications] Error sending to guild ${config.guildId}:`, error)
            }

            // Delay between messages
            await new Promise(resolve => setTimeout(resolve, 1000))
        }

        console.log('[Notifications] Daily notifications completed')
    } catch (error) {
        console.error('[Notifications] Error in daily notifications:', error)
    }
}
