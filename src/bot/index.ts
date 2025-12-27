import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    ChatInputCommandInteraction,
    Collection,
    ActivityType,
    ChannelType,
    PermissionFlagsBits,
    TextChannel,
    CategoryChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ButtonInteraction,
    AttachmentBuilder
} from 'discord.js'
import { prisma } from '../lib/db'
import { calculateIRJ, getTrophyDelta } from '../lib/utils/irj'

// Command interface
interface Command {
    data: SlashCommandBuilder
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>
}

// Create client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
})

// Command collection
const commands = new Collection<string, Command>()

// ============ HELPER FUNCTIONS ============

async function isAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const member = interaction.member as any
    if (!member) return false

    // Check for admin permission
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true

    // Check for configured admin role
    const config = await prisma.discordConfig.findUnique({
        where: { guildId: interaction.guildId! }
    })

    if (config?.adminRoleId && member.roles?.cache?.has(config.adminRoleId)) {
        return true
    }

    return false
}

// ============ COMMANDS DEFINITION ============

// /connect command  
const connectCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('connect')
        .setDescription('Connecter ce serveur Discord à un clan')
        .addStringOption(option =>
            option
                .setName('tag')
                .setDescription('Le tag du clan (ex: #ABC123)')
                .setRequired(true)
        ) as SlashCommandBuilder,
    async execute(interaction) {
        if (!await isAdmin(interaction)) {
            await interaction.reply({ content: '❌ Seuls les administrateurs peuvent utiliser cette commande.', ephemeral: true })
            return
        }

        await interaction.deferReply()

        const clanTag = interaction.options.getString('tag', true).toUpperCase()
        const guildId = interaction.guildId!

        const clan = await prisma.clan.findUnique({
            where: { tag: clanTag.startsWith('#') ? clanTag : `#${clanTag}` },
        })

        if (!clan) {
            await interaction.editReply({
                content: `❌ Clan \`${clanTag}\` non trouvé. Ajoutez-le d'abord via le site web: ${process.env.NEXT_PUBLIC_APP_URL}/explore`,
            })
            return
        }

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
            .setColor(0x22C55E)
            .setTitle('✅ Clan connecté !')
            .setDescription(`Ce serveur est maintenant lié à **${clan.name}**`)
            .addFields(
                { name: 'Tag', value: clan.tag, inline: true },
                { name: 'Niveau', value: `${clan.level || 'N/A'}`, inline: true },
                { name: 'Membres', value: `${clan.members || 0}`, inline: true },
            )
            .setFooter({ text: 'Utilisez /setup pour configurer les fonctionnalités' })
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    },
}

// /setup command - Configure claim system
const setupCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configurer le système ClashLens')
        .addSubcommand(sub =>
            sub.setName('claim')
                .setDescription('Configurer le système de revendication de profils')
        )
        .addSubcommand(sub =>
            sub.setName('admin')
                .setDescription('Définir le rôle admin')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Rôle qui peut gérer les claims')
                        .setRequired(true)
                )
        ) as SlashCommandBuilder,
    async execute(interaction) {
        if (!await isAdmin(interaction)) {
            await interaction.reply({ content: '❌ Seuls les administrateurs peuvent utiliser cette commande.', ephemeral: true })
            return
        }

        await interaction.deferReply()

        const subcommand = interaction.options.getSubcommand()
        const guildId = interaction.guildId!
        const guild = interaction.guild!

        const config = await prisma.discordConfig.findUnique({
            where: { guildId }
        })

        if (!config) {
            await interaction.editReply({ content: '❌ Aucun clan connecté. Utilisez `/connect` d\'abord.' })
            return
        }

        if (subcommand === 'claim') {
            try {
                // Create category for member channels
                const category = await guild.channels.create({
                    name: '📊 ClashLens Members',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                    ],
                })

                // Create verification channel (public)
                const verificationChannel = await guild.channels.create({
                    name: 'verification-coc',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                            deny: [PermissionFlagsBits.SendMessages],
                        },
                        {
                            id: client.user!.id,
                            allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
                        },
                    ],
                })

                // Update config
                await prisma.discordConfig.update({
                    where: { guildId },
                    data: {
                        claimCategoryId: category.id,
                        verificationChannelId: verificationChannel.id,
                    },
                })

                const embed = new EmbedBuilder()
                    .setColor(0x22C55E)
                    .setTitle('✅ Système de revendication configuré !')
                    .setDescription('Les membres peuvent maintenant utiliser `/claim` pour revendiquer leur profil CoC.')
                    .addFields(
                        { name: '📁 Catégorie', value: category.name, inline: true },
                        { name: '📝 Vérification', value: `<#${verificationChannel.id}>`, inline: true },
                    )
                    .setFooter({ text: 'Les admins recevront les demandes dans le salon de vérification' })

                await interaction.editReply({ embeds: [embed] })

                // Send welcome message in verification channel
                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x7C3AED)
                    .setTitle('🔗 Système de vérification ClashLens')
                    .setDescription('Les demandes de revendication de profils apparaîtront ici.\n\nLes administrateurs peuvent approuver ou rejeter les demandes.')
                    .addFields(
                        { name: '📋 Comment ça marche ?', value: '1. Un membre utilise `/claim <tag>`\n2. Il envoie une capture d\'écran\n3. Un admin approuve avec `/verify`\n4. Un salon privé est créé pour le joueur' },
                    )

                await verificationChannel.send({ embeds: [welcomeEmbed] })

            } catch (error) {
                console.error('[Bot] Setup error:', error)
                await interaction.editReply({ content: '❌ Erreur lors de la configuration. Vérifiez que le bot a les permissions nécessaires.' })
            }
        } else if (subcommand === 'admin') {
            const role = interaction.options.getRole('role', true)

            await prisma.discordConfig.update({
                where: { guildId },
                data: { adminRoleId: role.id },
            })

            await interaction.editReply({ content: `✅ Le rôle **${role.name}** peut maintenant gérer les claims.` })
        }
    },
}

// /claim command - Claim a CoC profile
const claimCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Revendiquer un profil Clash of Clans')
        .addStringOption(option =>
            option
                .setName('tag')
                .setDescription('Tag du joueur (ex: #ABC123)')
                .setRequired(true)
        ) as SlashCommandBuilder,
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true })

        const playerTag = interaction.options.getString('tag', true).toUpperCase()
        const tag = playerTag.startsWith('#') ? playerTag : `#${playerTag}`
        const guildId = interaction.guildId!
        const userId = interaction.user.id
        const username = interaction.user.username

        // Check if config exists
        const config = await prisma.discordConfig.findUnique({
            where: { guildId },
            include: { clan: true },
        })

        if (!config) {
            await interaction.editReply({ content: '❌ Aucun clan connecté à ce serveur.' })
            return
        }

        if (!config.verificationChannelId) {
            await interaction.editReply({ content: '❌ Le système de claim n\'est pas configuré. Demandez à un admin de faire `/setup claim`.' })
            return
        }

        // Check if player exists in clan
        const player = await prisma.player.findFirst({
            where: {
                tag,
                clanId: config.clan.id,
            },
        })

        if (!player) {
            await interaction.editReply({ content: `❌ Le joueur \`${tag}\` n'est pas dans le clan **${config.clan.name}**.` })
            return
        }

        // Check if already claimed by this user
        const existingClaim = await prisma.playerClaim.findFirst({
            where: {
                discordUserId: userId,
                guildId,
            },
        })

        if (existingClaim) {
            await interaction.editReply({ content: '❌ Vous avez déjà une demande en cours ou un profil revendiqué.' })
            return
        }

        // Check if player already claimed by someone else
        const playerClaimed = await prisma.playerClaim.findFirst({
            where: {
                playerId: player.id,
                guildId,
                status: 'approved',
            },
        })

        if (playerClaimed) {
            await interaction.editReply({ content: '❌ Ce joueur a déjà été revendiqué par quelqu\'un d\'autre.' })
            return
        }

        // Create claim request
        const claim = await prisma.playerClaim.create({
            data: {
                discordUserId: userId,
                discordUsername: username,
                playerId: player.id,
                guildId,
                status: 'pending',
            },
        })

        // Send to verification channel
        const verificationChannel = await interaction.guild!.channels.fetch(config.verificationChannelId) as TextChannel

        if (verificationChannel) {
            const claimEmbed = new EmbedBuilder()
                .setColor(0xFACC15)
                .setTitle('🆕 Nouvelle demande de revendication')
                .setDescription(`<@${userId}> souhaite revendiquer le profil **${player.name}**`)
                .addFields(
                    { name: '👤 Joueur CoC', value: `${player.name} (${player.tag})`, inline: true },
                    { name: '🏠 HDV', value: `${player.townHallLevel || 'N/A'}`, inline: true },
                    { name: '📋 Status', value: '⏳ En attente de vérification', inline: false },
                )
                .setFooter({ text: `Claim ID: ${claim.id}` })
                .setTimestamp()

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`claim_approve_${claim.id}`)
                        .setLabel('✅ Approuver')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`claim_reject_${claim.id}`)
                        .setLabel('❌ Rejeter')
                        .setStyle(ButtonStyle.Danger),
                )

            await verificationChannel.send({
                content: `📸 <@${userId}>, envoyez une capture d'écran de votre profil CoC ici pour prouver que c'est bien vous !`,
                embeds: [claimEmbed],
                components: [row]
            })
        }

        await interaction.editReply({
            content: `✅ Demande envoyée ! Envoyez une capture d'écran de votre profil dans <#${config.verificationChannelId}> pour vérification.`
        })
    },
}

// /verify command - Admin verify claims
const verifyCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Gérer les demandes de revendication')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à vérifier')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('action')
                .setDescription('Action à effectuer')
                .setRequired(true)
                .addChoices(
                    { name: 'Approuver', value: 'approve' },
                    { name: 'Rejeter', value: 'reject' }
                )
        )
        .addStringOption(option =>
            option
                .setName('raison')
                .setDescription('Raison du rejet')
        ) as SlashCommandBuilder,
    async execute(interaction) {
        if (!await isAdmin(interaction)) {
            await interaction.reply({ content: '❌ Seuls les administrateurs peuvent utiliser cette commande.', ephemeral: true })
            return
        }

        await interaction.deferReply()

        const targetUser = interaction.options.getUser('user', true)
        const action = interaction.options.getString('action', true)
        const reason = interaction.options.getString('raison')
        const guildId = interaction.guildId!
        const guild = interaction.guild!

        // Find pending claim
        const claim = await prisma.playerClaim.findFirst({
            where: {
                discordUserId: targetUser.id,
                guildId,
                status: 'pending',
            },
            include: { player: true },
        })

        if (!claim) {
            await interaction.editReply({ content: `❌ Aucune demande en attente pour <@${targetUser.id}>.` })
            return
        }

        const config = await prisma.discordConfig.findUnique({
            where: { guildId },
        })

        if (action === 'approve') {
            // Update claim status
            await prisma.playerClaim.update({
                where: { id: claim.id },
                data: {
                    status: 'approved',
                    reviewedAt: new Date(),
                    reviewedBy: interaction.user.id,
                },
            })

            // Create private channel for the player
            let privateChannel: TextChannel | null = null

            if (config?.claimCategoryId) {
                try {
                    const channelName = `${claim.player.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${claim.player.tag.replace('#', '').toLowerCase()}`

                    privateChannel = await guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: config.claimCategoryId,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.ViewChannel],
                            },
                            {
                                id: targetUser.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                            },
                            {
                                id: client.user!.id,
                                allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
                            },
                        ],
                    }) as TextChannel

                    // Save channel to database
                    await prisma.playerChannel.create({
                        data: {
                            discordUserId: targetUser.id,
                            discordChannelId: privateChannel.id,
                            guildId,
                            playerId: claim.player.id,
                        },
                    })

                    // Send welcome message
                    const welcomeEmbed = new EmbedBuilder()
                        .setColor(0x22C55E)
                        .setTitle(`🎉 Bienvenue ${claim.player.name} !`)
                        .setDescription('Votre profil a été vérifié avec succès. Ce salon vous est dédié.')
                        .addFields(
                            { name: '🏷️ Tag', value: claim.player.tag, inline: true },
                            { name: '🏠 HDV', value: `${claim.player.townHallLevel || 'N/A'}`, inline: true },
                            { name: '📊 Dashboard', value: `[Voir mes stats](${process.env.NEXT_PUBLIC_APP_URL}/player/${encodeURIComponent(claim.player.tag)})`, inline: true },
                        )
                        .setFooter({ text: 'Vous recevrez ici des rappels personnalisés' })

                    await privateChannel.send({ content: `<@${targetUser.id}>`, embeds: [welcomeEmbed] })

                } catch (error) {
                    console.error('[Bot] Error creating channel:', error)
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setTitle('✅ Revendication approuvée')
                .setDescription(`<@${targetUser.id}> est maintenant lié à **${claim.player.name}**`)
                .addFields(
                    { name: 'Joueur', value: `${claim.player.name} (${claim.player.tag})`, inline: true },
                    { name: 'Salon privé', value: privateChannel ? `<#${privateChannel.id}>` : 'Non créé', inline: true },
                )

            await interaction.editReply({ embeds: [embed] })

            // Notify user
            try {
                await targetUser.send({
                    content: `✅ Votre demande de revendication pour **${claim.player.name}** a été approuvée !`,
                })
            } catch (e) {
                // User has DMs disabled
            }

        } else {
            // Reject claim
            await prisma.playerClaim.update({
                where: { id: claim.id },
                data: {
                    status: 'rejected',
                    rejectionReason: reason,
                    reviewedAt: new Date(),
                    reviewedBy: interaction.user.id,
                },
            })

            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setTitle('❌ Revendication rejetée')
                .setDescription(`La demande de <@${targetUser.id}> a été rejetée.`)
                .addFields(
                    { name: 'Joueur', value: `${claim.player.name} (${claim.player.tag})`, inline: true },
                    { name: 'Raison', value: reason || 'Non spécifiée', inline: true },
                )

            await interaction.editReply({ embeds: [embed] })

            // Notify user
            try {
                await targetUser.send({
                    content: `❌ Votre demande de revendication pour **${claim.player.name}** a été rejetée.${reason ? `\nRaison: ${reason}` : ''}`,
                })
            } catch (e) {
                // User has DMs disabled
            }
        }
    },
}

// /notify command - Send notifications
const notifyCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('notify')
        .setDescription('Envoyer une notification à un joueur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à notifier (ou "all" pour tous)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Message à envoyer')
                .setRequired(true)
        ) as SlashCommandBuilder,
    async execute(interaction) {
        if (!await isAdmin(interaction)) {
            await interaction.reply({ content: '❌ Seuls les administrateurs peuvent utiliser cette commande.', ephemeral: true })
            return
        }

        await interaction.deferReply()

        const targetUser = interaction.options.getUser('user', true)
        const message = interaction.options.getString('message', true)
        const guildId = interaction.guildId!

        // Find user's private channel
        const playerChannel = await prisma.playerChannel.findFirst({
            where: {
                discordUserId: targetUser.id,
                guildId,
            },
            include: { player: true },
        })

        if (!playerChannel) {
            await interaction.editReply({ content: `❌ <@${targetUser.id}> n'a pas de salon privé (profil non vérifié).` })
            return
        }

        const channel = await interaction.guild!.channels.fetch(playerChannel.discordChannelId) as TextChannel

        if (!channel) {
            await interaction.editReply({ content: '❌ Le salon privé n\'existe plus.' })
            return
        }

        const notifEmbed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle('📢 Notification')
            .setDescription(message)
            .setFooter({ text: `De: ${interaction.user.username}` })
            .setTimestamp()

        await channel.send({ content: `<@${targetUser.id}>`, embeds: [notifEmbed] })

        await interaction.editReply({ content: `✅ Notification envoyée à <@${targetUser.id}> dans <#${channel.id}>` })
    },
}

// /clan command
const clanCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('clan')
        .setDescription('Afficher les informations du clan connecté') as SlashCommandBuilder,
    async execute(interaction) {
        await interaction.deferReply()

        const config = await prisma.discordConfig.findUnique({
            where: { guildId: interaction.guildId! },
            include: { clan: true },
        })

        if (!config) {
            await interaction.editReply({ content: '❌ Aucun clan connecté. Utilisez `/connect <tag>`.' })
            return
        }

        const clan = config.clan
        const membersCount = await prisma.player.count({ where: { clanId: clan.id } })
        const verifiedCount = await prisma.playerClaim.count({
            where: { guildId: interaction.guildId!, status: 'approved' }
        })

        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle(`🏰 ${clan.name}`)
            .setDescription(`Clan de niveau ${clan.level || 'N/A'}`)
            .addFields(
                { name: '🏷️ Tag', value: clan.tag, inline: true },
                { name: '👥 Membres', value: `${membersCount}/50`, inline: true },
                { name: '✅ Vérifiés', value: `${verifiedCount}`, inline: true },
                { name: '🔗 Dashboard', value: `[Ouvrir](${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${encodeURIComponent(clan.tag)})`, inline: false },
            )
            .setTimestamp()
            .setFooter({ text: 'ClashLens' })

        await interaction.editReply({ embeds: [embed] })
    },
}

// /stats command
const statsCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Résumé des performances du clan')
        .addStringOption(option =>
            option
                .setName('periode')
                .setDescription('Période d\'analyse')
                .addChoices(
                    { name: '7 jours', value: '7' },
                    { name: '30 jours', value: '30' }
                )
        ) as SlashCommandBuilder,
    async execute(interaction) {
        await interaction.deferReply()

        const days = parseInt(interaction.options.getString('periode') || '7')
        const config = await prisma.discordConfig.findUnique({
            where: { guildId: interaction.guildId! },
            include: { clan: true },
        })

        if (!config) {
            await interaction.editReply({ content: '❌ Aucun clan connecté.' })
            return
        }

        const players = await prisma.player.findMany({
            where: { clanId: config.clan.id },
            include: { snapshots: { orderBy: { timestamp: 'desc' }, take: 100 } },
        })

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
                player.snapshots.map(s => ({ timestamp: s.timestamp, trophies: s.trophies })),
                days
            )
            return { player, irj: irj.totalScore, trophyDelta }
        })

        const topIRJ = playersWithStats.sort((a, b) => b.irj - a.irj).slice(0, 5)
        const topGainers = [...playersWithStats].sort((a, b) => b.trophyDelta - a.trophyDelta).slice(0, 5)

        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle(`📊 ${config.clan.name} - Stats ${days}j`)
            .addFields(
                {
                    name: '🏆 Top 5 IRJ',
                    value: topIRJ.map((p, i) => `${['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} ${p.player.name} - **${p.irj}**`).join('\n') || 'Aucune donnée',
                },
                {
                    name: '📈 Top 5 Progression',
                    value: topGainers.map((p, i) => `${['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} ${p.player.name} - **${p.trophyDelta > 0 ? '+' : ''}${p.trophyDelta}** 🏆`).join('\n') || 'Aucune donnée',
                }
            )
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    },
}

// /help command
const helpCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Liste des commandes disponibles') as SlashCommandBuilder,
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle('📚 Commandes ClashLens')
            .setDescription('Analysez les performances de votre clan Clash of Clans')
            .addFields(
                { name: '🔗 Connexion', value: '`/connect <tag>` - Connecter un clan\n`/setup claim` - Configurer les claims\n`/setup admin <role>` - Définir le rôle admin', inline: false },
                { name: '👤 Profils', value: '`/claim <tag>` - Revendiquer un profil\n`/verify <user> <action>` - Vérifier une demande', inline: false },
                { name: '📊 Stats', value: '`/clan` - Infos du clan\n`/stats [période]` - Top performers', inline: false },
                { name: '📢 Notifications', value: '`/notify <user> <message>` - Envoyer un rappel', inline: false },
            )
            .setFooter({ text: 'ClashLens - Analytics pour Clash of Clans' })
            .setTimestamp()

        await interaction.reply({ embeds: [embed] })
    },
}

// Register all commands
commands.set('connect', connectCommand)
commands.set('setup', setupCommand)
commands.set('claim', claimCommand)
commands.set('verify', verifyCommand)
commands.set('notify', notifyCommand)
commands.set('clan', clanCommand)
commands.set('stats', statsCommand)
commands.set('help', helpCommand)

// ============ EVENT HANDLERS ============

client.once('ready', async () => {
    console.log(`[Bot] ✅ Connecté en tant que ${client.user?.tag}`)

    client.user?.setActivity('Clash of Clans', { type: ActivityType.Watching })

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)
    const commandsData = Array.from(commands.values()).map(cmd => cmd.data.toJSON())

    try {
        console.log('[Bot] 📝 Enregistrement des commandes...')

        // Register to each guild
        for (const guild of client.guilds.cache.values()) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guild.id),
                { body: commandsData }
            )
            console.log(`[Bot] ✅ Commandes enregistrées pour: ${guild.name}`)
        }

        // Also register globally
        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
            { body: commandsData }
        )

        console.log(`[Bot] ✅ ${commandsData.length} commandes enregistrées`)
    } catch (error) {
        console.error('[Bot] ❌ Erreur enregistrement:', error)
    }
})

client.on('guildCreate', async (guild) => {
    console.log(`[Bot] 📥 Rejoint: ${guild.name}`)

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)
    const commandsData = Array.from(commands.values()).map(cmd => cmd.data.toJSON())

    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guild.id),
            { body: commandsData }
        )
    } catch (error) {
        console.error(`[Bot] ❌ Erreur pour ${guild.name}:`, error)
    }
})

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName)

        if (!command) return

        try {
            await command.execute(interaction)
        } catch (error) {
            console.error(`[Bot] ❌ Erreur ${interaction.commandName}:`, error)

            const msg = '❌ Une erreur est survenue.'
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: msg })
            } else {
                await interaction.reply({ content: msg, ephemeral: true })
            }
        }
    }

    // Handle button interactions (approve/reject claims)
    if (interaction.isButton()) {
        const buttonInteraction = interaction as ButtonInteraction
        const customId = buttonInteraction.customId

        if (customId.startsWith('claim_approve_') || customId.startsWith('claim_reject_')) {
            const member = buttonInteraction.member as any
            const isAdminUser = member?.permissions?.has(PermissionFlagsBits.Administrator)

            if (!isAdminUser) {
                await buttonInteraction.reply({ content: '❌ Seuls les admins peuvent faire ça.', ephemeral: true })
                return
            }

            const claimId = customId.replace('claim_approve_', '').replace('claim_reject_', '')
            const action = customId.startsWith('claim_approve_') ? 'approve' : 'reject'

            const claim = await prisma.playerClaim.findUnique({
                where: { id: claimId },
                include: { player: true },
            })

            if (!claim || claim.status !== 'pending') {
                await buttonInteraction.reply({ content: '❌ Cette demande a déjà été traitée.', ephemeral: true })
                return
            }

            if (action === 'approve') {
                await prisma.playerClaim.update({
                    where: { id: claimId },
                    data: {
                        status: 'approved',
                        reviewedAt: new Date(),
                        reviewedBy: buttonInteraction.user.id,
                    },
                })

                // Create private channel
                const config = await prisma.discordConfig.findUnique({
                    where: { guildId: buttonInteraction.guildId! },
                })

                if (config?.claimCategoryId) {
                    const channelName = `${claim.player.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`

                    const privateChannel = await buttonInteraction.guild!.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: config.claimCategoryId,
                        permissionOverwrites: [
                            { id: buttonInteraction.guild!.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: claim.discordUserId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
                            { id: client.user!.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
                        ],
                    })

                    await prisma.playerChannel.create({
                        data: {
                            discordUserId: claim.discordUserId,
                            discordChannelId: privateChannel.id,
                            guildId: buttonInteraction.guildId!,
                            playerId: claim.player.id,
                        },
                    })

                    const welcomeEmbed = new EmbedBuilder()
                        .setColor(0x22C55E)
                        .setTitle(`🎉 Bienvenue ${claim.player.name} !`)
                        .setDescription('Votre profil a été vérifié. Ce salon vous est dédié.')

                    await (privateChannel as TextChannel).send({
                        content: `<@${claim.discordUserId}>`,
                        embeds: [welcomeEmbed]
                    })
                }

                await buttonInteraction.update({
                    content: `✅ Approuvé par <@${buttonInteraction.user.id}>`,
                    components: [],
                })
            } else {
                await prisma.playerClaim.update({
                    where: { id: claimId },
                    data: {
                        status: 'rejected',
                        reviewedAt: new Date(),
                        reviewedBy: buttonInteraction.user.id,
                    },
                })

                await buttonInteraction.update({
                    content: `❌ Rejeté par <@${buttonInteraction.user.id}>`,
                    components: [],
                })
            }
        }
    }
})

// ============ START BOT ============

async function startBot() {
    if (!process.env.DISCORD_TOKEN) {
        console.error('[Bot] ❌ DISCORD_TOKEN manquant')
        process.exit(1)
    }

    if (!process.env.DISCORD_CLIENT_ID) {
        console.error('[Bot] ❌ DISCORD_CLIENT_ID manquant')
        process.exit(1)
    }

    try {
        await client.login(process.env.DISCORD_TOKEN)
    } catch (error) {
        console.error('[Bot] ❌ Échec connexion:', error)
        process.exit(1)
    }
}

startBot()
