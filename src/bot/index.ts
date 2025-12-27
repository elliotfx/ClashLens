import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { prisma } from '../lib/db'
import { calculateIRJ, getTrophyDelta } from '../lib/utils/irj'

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
})

// Define slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('clash')
        .setDescription('Clash of Clans clan analytics')
        .addSubcommand(subcommand =>
            subcommand
                .setName('connect')
                .setDescription('Connect your Discord server to a clan')
                .addStringOption(option =>
                    option
                        .setName('clan_tag')
                        .setDescription('The clan tag (e.g., #ABC123)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('summary')
                .setDescription('Get a summary of clan performance')
                .addStringOption(option =>
                    option
                        .setName('period')
                        .setDescription('Time period for summary')
                        .setRequired(false)
                        .addChoices(
                            { name: '7 days', value: '7d' },
                            { name: '30 days', value: '30d' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('Get the web dashboard link')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('player')
                .setDescription('Get player stats')
                .addStringOption(option =>
                    option
                        .setName('tag')
                        .setDescription('Player tag')
                        .setRequired(true)
                )
        ),
].map(command => command.toJSON())

client.once('ready', async () => {
    console.log(`[Discord Bot] Logged in as ${client.user?.tag}`)

    // Register slash commands
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)
        console.log('[Discord Bot] Refreshing slash commands...')

        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
            { body: commands }
        )

        console.log('[Discord Bot] Successfully registered slash commands')
    } catch (error) {
        console.error('[Discord Bot] Error registering commands:', error)
    }
})

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return

    if (interaction.commandName === 'clash') {
        const subcommand = interaction.options.getSubcommand()

        try {
            if (subcommand === 'connect') {
                await handleConnect(interaction)
            } else if (subcommand === 'summary') {
                await handleSummary(interaction)
            } else if (subcommand === 'dashboard') {
                await handleDashboard(interaction)
            } else if (subcommand === 'player') {
                await handlePlayer(interaction)
            }
        } catch (error) {
            console.error('[Discord Bot] Command error:', error)
            await interaction.reply({
                content: 'An error occurred while processing your command.',
                ephemeral: true,
            })
        }
    }
})

async function handleConnect(interaction: any) {
    await interaction.deferReply()

    const clanTag = interaction.options.getString('clan_tag')
    const guildId = interaction.guildId

    try {
        // Find clan in database
        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag.toUpperCase() },
        })

        if (!clan) {
            await interaction.editReply({
                content: `Clan ${clanTag} not found. Please connect it first via the web interface: ${process.env.NEXT_PUBLIC_APP_URL}/connect`,
            })
            return
        }

        // Create or update Discord config
        await prisma.discordConfig.upsert({
            where: { guildId },
            create: {
                guildId,
                clanId: clan.id,
                notificationChannelId: interaction.channelId,
            },
            update: {
                clanId: clan.id,
                notificationChannelId: interaction.channelId,
            },
        })

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('✅ Clan Connected!')
            .setDescription(`Your Discord server is now connected to **${clan.name}**`)
            .addFields(
                { name: 'Clan Tag', value: clan.tag, inline: true },
                { name: 'Members', value: clan.members?.toString() || 'N/A', inline: true },
                { name: 'Level', value: clan.level?.toString() || 'N/A', inline: true }
            )
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    } catch (error) {
        console.error('[Discord Bot] Connect error:', error)
        await interaction.editReply({
            content: 'Failed to connect clan. Please try again.',
        })
    }
}

async function handleSummary(interaction: any) {
    await interaction.deferReply()

    const period = interaction.options.getString('period') || '7d'
    const days = period === '30d' ? 30 : 7
    const guildId = interaction.guildId

    try {
        // Get Discord config
        const config = await prisma.discordConfig.findUnique({
            where: { guildId },
            include: { clan: true },
        })

        if (!config) {
            await interaction.editReply({
                content: 'No clan connected to this server. Use `/clash connect` first.',
            })
            return
        }

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

            const trophyDelta = getTrophyDelta(
                player.snapshots.map(s => ({
                    timestamp: s.timestamp,
                    trophies: s.trophies,
                })),
                days
            )

            return { player, irj: irj.totalScore, trophyDelta }
        })

        // Top 5 IRJ
        const topIRJ = playersWithStats.sort((a, b) => b.irj - a.irj).slice(0, 5)

        // Top 5 trophy gainers
        const topGainers = playersWithStats.sort((a, b) => b.trophyDelta - a.trophyDelta).slice(0, 5)

        // Inactive players (no snapshot in last 3 days)
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        const inactivePlayers = players.filter(
            p => !p.snapshots[0] || p.snapshots[0].timestamp < threeDaysAgo
        )

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`📊 ${config.clan.name} - ${period} Summary`)
            .setDescription(`Performance overview for the last ${days} days`)
            .addFields(
                {
                    name: '🏆 Top 5 IRJ Scores',
                    value: topIRJ
                        .map((p, i) => `${i + 1}. ${p.player.name} - **${p.irj}**`)
                        .join('\n') || 'No data',
                    inline: false,
                },
                {
                    name: '📈 Top 5 Trophy Gainers',
                    value: topGainers
                        .map((p, i) => `${i + 1}. ${p.player.name} - **+${p.trophyDelta}**`)
                        .join('\n') || 'No data',
                    inline: false,
                }
            )
            .setTimestamp()

        if (inactivePlayers.length > 0) {
            embed.addFields({
                name: '⚠️ Inactive Members',
                value: `${inactivePlayers.length} member(s) haven't been seen in 3+ days`,
                inline: false,
            })
        }

        await interaction.editReply({ embeds: [embed] })
    } catch (error) {
        console.error('[Discord Bot] Summary error:', error)
        await interaction.editReply({
            content: 'Failed to generate summary.',
        })
    }
}

async function handleDashboard(interaction: any) {
    await interaction.deferReply()

    const guildId = interaction.guildId

    try {
        const config = await prisma.discordConfig.findUnique({
            where: { guildId },
            include: { clan: true },
        })

        if (!config) {
            await interaction.editReply({
                content: 'No clan connected to this server. Use `/clash connect` first.',
            })
            return
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🌐 Web Dashboard')
            .setDescription(`View detailed analytics for **${config.clan.name}**`)
            .addFields({
                name: 'Dashboard Link',
                value: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${encodeURIComponent(config.clan.tag)}`,
            })
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    } catch (error) {
        console.error('[Discord Bot] Dashboard error:', error)
        await interaction.editReply({
            content: 'Failed to get dashboard link.',
        })
    }
}

async function handlePlayer(interaction: any) {
    await interaction.deferReply()

    const playerTag = interaction.options.getString('tag')

    try {
        const player = await prisma.player.findUnique({
            where: { tag: playerTag.toUpperCase() },
            include: {
                snapshots: {
                    orderBy: { timestamp: 'desc' },
                    take: 100,
                },
                clan: true,
            },
        })

        if (!player) {
            await interaction.editReply({
                content: `Player ${playerTag} not found.`,
            })
            return
        }

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

        const latestSnapshot = player.snapshots[0]

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`👤 ${player.name}`)
            .setDescription(player.clan ? `Member of **${player.clan.name}**` : 'No clan')
            .addFields(
                { name: 'Tag', value: player.tag, inline: true },
                { name: 'Town Hall', value: `TH${player.townHallLevel}`, inline: true },
                { name: 'Role', value: player.role || 'Member', inline: true },
                { name: 'Trophies', value: latestSnapshot?.trophies.toLocaleString() || 'N/A', inline: true },
                { name: '7d Change', value: trophyDelta7d > 0 ? `+${trophyDelta7d}` : trophyDelta7d.toString(), inline: true },
                { name: 'IRJ Score', value: `${irj.totalScore}/100`, inline: true }
            )
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    } catch (error) {
        console.error('[Discord Bot] Player error:', error)
        await interaction.editReply({
            content: 'Failed to get player stats.',
        })
    }
}

// Start the bot
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(error => {
        console.error('[Discord Bot] Login error:', error)
        process.exit(1)
    })
} else {
    console.error('[Discord Bot] DISCORD_TOKEN not found in environment variables')
    process.exit(1)
}
