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
    AttachmentBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction
} from 'discord.js'
import { prisma } from '../lib/db'
import { calculateIRJ, getTrophyDelta } from '../lib/utils/irj'

// Map to track which channel each claim was created in (Key: claimId, Value: channelId)
const claimChannels = new Map<string, string>()

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
        )
        .addSubcommand(sub =>
            sub.setName('coach')
                .setDescription('Définir le rôle coach')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Rôle qui peut voir les channels privés des joueurs')
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

                const welcomeMessage = await verificationChannel.send({ embeds: [welcomeEmbed] })

                // Pin the welcome message
                try {
                    await welcomeMessage.pin()
                } catch (error) {
                    console.log('[Bot] Could not pin welcome message')
                }

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
        } else if (subcommand === 'coach') {
            const role = interaction.options.getRole('role', true)

            await prisma.discordConfig.update({
                where: { guildId },
                data: { coachRoleId: role.id },
            })

            await interaction.editReply({ content: `✅ Le rôle **${role.name}** peut maintenant voir les channels privés des joueurs.` })
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
                .setName('search')
                .setDescription('Rechercher un joueur par son nom (optionnel)')
                .setRequired(false)
        ) as SlashCommandBuilder,
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true })

        const searchQuery = interaction.options.getString('search')
        const guildId = interaction.guildId!
        const userId = interaction.user.id

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

        // Check if already has a PENDING or APPROVED claim (ignore rejected ones)
        const existingClaim = await prisma.playerClaim.findFirst({
            where: {
                discordUserId: userId,
                guildId,
                status: {
                    in: ['pending', 'approved']
                }
            },
        })

        if (existingClaim) {
            await interaction.editReply({ content: '❌ Vous avez déjà une demande en cours ou un profil revendiqué.' })
            return
        }

        // Get all players from clan
        const players = await prisma.player.findMany({
            where: { clanId: config.clanId },
            orderBy: { name: 'asc' }
        })

        if (players.length === 0) {
            await interaction.editReply({ content: '❌ Aucun joueur trouvé dans le clan.' })
            return
        }

        // Filter by search query if provided
        let filteredPlayers = players
        if (searchQuery) {
            filteredPlayers = players.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
            )

            if (filteredPlayers.length === 0) {
                await interaction.editReply({
                    content: `❌ Aucun joueur trouvé avec "${searchQuery}"\n\nUtilisez \`/list ${searchQuery}\` pour voir les joueurs disponibles.`
                })
                return
            }
        }

        // Get already claimed players
        const claimedPlayerIds = await prisma.playerClaim.findMany({
            where: { guildId, status: 'approved' },
            select: { playerId: true }
        }).then(claims => claims.map(c => c.playerId))

        // Filter out already claimed players
        const availablePlayers = filteredPlayers.filter(p => !claimedPlayerIds.includes(p.id))

        if (availablePlayers.length === 0) {
            await interaction.editReply({ content: '❌ Tous les joueurs trouvés sont déjà revendiqués.' })
            return
        }

        // Create select menu (max 25 options)
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`claim_select_${userId}`)
            .setPlaceholder(searchQuery ? `${availablePlayers.length} joueur(s) trouvé(s)` : 'Sélectionnez votre joueur')
            .addOptions(
                availablePlayers.slice(0, 25).map(player => ({
                    label: `${player.name} ${player.townHallLevel ? `(HDV ${player.townHallLevel})` : ''}`.slice(0, 100),
                    description: `${player.tag} - ${player.trophies || 0} trophées`.slice(0, 100),
                    value: player.tag
                }))
            )

        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(selectMenu)

        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle('📋 Sélectionnez votre joueur')
            .setDescription(searchQuery ?
                `**Résultats pour "${searchQuery}"** - ${availablePlayers.length} joueur(s)\n\nChoisissez votre profil dans la liste ci-dessous :` :
                `**${availablePlayers.length} joueur(s) disponibles** dans ${config.clan.name}\n\nChoisissez votre profil dans la liste ci-dessous :`
            )
            .setFooter({ text: availablePlayers.length > 25 ? `Affichage de 25/${availablePlayers.length} joueurs. Utilisez /claim search:<nom> pour affiner.` : null })

        await interaction.editReply({
            embeds: [embed],
            components: [row]
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

// /config command - Server configuration management
const configCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Gérer la configuration du serveur')
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Supprimer toute la configuration ClashLens')
        )
        .addSubcommandGroup(group =>
            group.setName('claims')
                .setDescription('Gérer les revendications')
                .addSubcommand(sub =>
                    sub.setName('list')
                        .setDescription('Voir toutes les revendications')
                        .addStringOption(opt =>
                            opt.setName('status')
                                .setDescription('Filtrer par statut')
                                .addChoices(
                                    { name: 'En attente', value: 'pending' },
                                    { name: 'Approuvé', value: 'approved' },
                                    { name: 'Rejeté', value: 'rejected' }
                                )
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('delete')
                        .setDescription('Supprimer une revendication')
                        .addStringOption(opt =>
                            opt.setName('claim_id')
                                .setDescription('ID du claim (ex: cmjol5xnv0001ionbsty3w2nh)')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('add')
                        .setDescription('Créer une revendication manuellement')
                        .addUserOption(opt =>
                            opt.setName('user')
                                .setDescription('Utilisateur Discord')
                                .setRequired(true)
                        )
                        .addStringOption(opt =>
                            opt.setName('player_tag')
                                .setDescription('Tag du joueur (ex: #ABC123)')
                                .setRequired(true)
                        )
                )
        ) as SlashCommandBuilder,
    async execute(interaction) {
        if (!await isAdmin(interaction)) {
            await interaction.reply({ content: '❌ Seuls les administrateurs peuvent utiliser cette commande.', ephemeral: true })
            return
        }

        const subcommand = interaction.options.getSubcommand()
        const subcommandGroup = interaction.options.getSubcommandGroup()
        const guildId = interaction.guildId!
        const guild = interaction.guild!

        // Handle /config reset
        if (subcommand === 'reset') {
            await interaction.deferReply()

            try {
                const config = await prisma.discordConfig.findUnique({
                    where: { guildId },
                    include: { clan: true }
                })

                if (!config) {
                    await interaction.editReply({ content: '❌ Aucune configuration trouvée pour ce serveur.' })
                    return
                }

                // Delete all player claims for this guild
                await prisma.playerClaim.deleteMany({
                    where: { guildId }
                })

                // Delete all player channels for this guild
                const playerChannels = await prisma.playerChannel.findMany({
                    where: { guildId }
                })

                // Delete Discord channels
                for (const pc of playerChannels) {
                    try {
                        const channel = await guild.channels.fetch(pc.discordChannelId)
                        if (channel) await channel.delete()
                    } catch (err) {
                        console.log(`[Bot] Could not delete channel ${pc.discordChannelId}`)
                    }
                }

                await prisma.playerChannel.deleteMany({
                    where: { guildId }
                })

                // Delete verification channel and category
                if (config.verificationChannelId) {
                    try {
                        const verificationChannel = await guild.channels.fetch(config.verificationChannelId)
                        if (verificationChannel) await verificationChannel.delete()
                    } catch (err) {
                        console.log('[Bot] Could not delete verification channel')
                    }
                }

                if (config.claimCategoryId) {
                    try {
                        const category = await guild.channels.fetch(config.claimCategoryId)
                        if (category) await category.delete()
                    } catch (err) {
                        console.log('[Bot] Could not delete category')
                    }
                }

                // Delete config from database
                await prisma.discordConfig.delete({
                    where: { guildId }
                })

                const embed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setTitle('🗑️ Configuration supprimée')
                    .setDescription('Toute la configuration ClashLens a été supprimée de ce serveur.')
                    .addFields(
                        { name: 'Clan déconnecté', value: config.clan.name, inline: true },
                        { name: 'Claims supprimés', value: 'Tous', inline: true },
                        { name: 'Channels supprimés', value: 'Tous', inline: true },
                    )
                    .setFooter({ text: 'Utilisez /connect pour reconnecter un clan' })

                await interaction.editReply({ embeds: [embed] })

            } catch (error) {
                console.error('[Bot] Config reset error:', error)
                await interaction.editReply({ content: '❌ Erreur lors de la suppression de la configuration.' })
            }
        }

        // Handle /config claims list
        if (subcommandGroup === 'claims' && subcommand === 'list') {
            await interaction.deferReply({ ephemeral: true })

            const statusFilter = interaction.options.getString('status') as 'pending' | 'approved' | 'rejected' | null

            try {
                const claims = await prisma.playerClaim.findMany({
                    where: {
                        guildId,
                        ...(statusFilter && { status: statusFilter })
                    },
                    include: { player: true },
                    orderBy: { requestedAt: 'desc' }
                })

                if (claims.length === 0) {
                    await interaction.editReply({ content: '❌ Aucun claim trouvé.' })
                    return
                }

                const embed = new EmbedBuilder()
                    .setColor(0x7C3AED)
                    .setTitle(`📋 Claims ${statusFilter ? `(${statusFilter})` : ''}`)
                    .setDescription(`${claims.length} claim(s) total`)

                for (const claim of claims.slice(0, 25)) {
                    const statusEmoji = claim.status === 'approved' ? '✅' : claim.status === 'rejected' ? '❌' : '⏳'
                    embed.addFields({
                        name: `${statusEmoji} ${claim.player.name}`,
                        value: `User: <@${claim.discordUserId}>\nStatus: ${claim.status}\nID: \`${claim.id}\``,
                        inline: true
                    })
                }

                await interaction.editReply({ embeds: [embed] })
            } catch (error) {
                console.error('[Bot] Claims list error:', error)
                await interaction.editReply({ content: '❌ Erreur lors de la récupération des claims.' })
            }
        }

        // Handle /config claims delete
        if (subcommandGroup === 'claims' && subcommand === 'delete') {
            await interaction.deferReply({ ephemeral: true })

            const claimId = interaction.options.getString('claim_id', true)

            try {
                const claim = await prisma.playerClaim.findUnique({
                    where: { id: claimId },
                    include: { player: true }
                })

                if (!claim || claim.guildId !== guildId) {
                    await interaction.editReply({ content: '❌ Claim non trouvé.' })
                    return
                }

                await prisma.playerClaim.delete({
                    where: { id: claimId }
                })

                // Remove from tracking map
                claimChannels.delete(claimId)

                await interaction.editReply({ content: `✅ Claim de **${claim.player.name}** supprimé.` })
            } catch (error) {
                console.error('[Bot] Claims delete error:', error)
                await interaction.editReply({ content: '❌ Erreur lors de la suppression du claim.' })
            }
        }

        // Handle /config claims add
        if (subcommandGroup === 'claims' && subcommand === 'add') {
            await interaction.deferReply({ ephemeral: true })

            const user = interaction.options.getUser('user', true)
            const playerTag = interaction.options.getString('player_tag', true)

            try {
                const config = await prisma.discordConfig.findUnique({
                    where: { guildId }
                })

                if (!config) {
                    await interaction.editReply({ content: '❌ Aucune configuration trouvée.' })
                    return
                }

                // Find player
                const player = await prisma.player.findUnique({
                    where: { tag: playerTag }
                })

                if (!player) {
                    await interaction.editReply({ content: `❌ Joueur ${playerTag} non trouvé.` })
                    return
                }

                // Create claim
                const claim = await prisma.playerClaim.create({
                    data: {
                        discordUserId: user.id,
                        discordUsername: user.username,
                        playerId: player.id,
                        guildId,
                        status: 'approved',
                        reviewedAt: new Date(),
                        reviewedBy: interaction.user.id
                    }
                })

                await interaction.editReply({ content: `✅ Claim créé et approuvé pour <@${user.id}> → **${player.name}**` })
            } catch (error) {
                console.error('[Bot] Claims add error:', error)
                await interaction.editReply({ content: '❌ Erreur lors de la création du claim.' })
            }
        }
    },
}

// /list command - List players from the clan
const listCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Lister les joueurs du clan')
        .addStringOption(option =>
            option
                .setName('search')
                .setDescription('Rechercher un joueur par son nom (optionnel)')
                .setRequired(false)
        ) as SlashCommandBuilder,
    async execute(interaction) {
        await interaction.deferReply()

        const guildId = interaction.guildId!
        const searchQuery = interaction.options.getString('search')

        try {
            const config = await prisma.discordConfig.findUnique({
                where: { guildId },
                include: { clan: true }
            })

            if (!config) {
                await interaction.editReply({ content: '❌ Aucun clan connecté. Utilisez `/connect` d\'abord.' })
                return
            }

            // Get all players from the clan
            const players = await prisma.player.findMany({
                where: { clanId: config.clanId },
                orderBy: { name: 'asc' }
            })

            if (players.length === 0) {
                await interaction.editReply({ content: '❌ Aucun joueur trouvé dans le clan.' })
                return
            }

            // Filter by search query if provided
            let filteredPlayers = players
            if (searchQuery) {
                filteredPlayers = players.filter(p =>
                    p.name.toLowerCase().startsWith(searchQuery.toLowerCase())
                )

                if (filteredPlayers.length === 0) {
                    await interaction.editReply({
                        content: `❌ Aucun joueur trouvé commençant par "${searchQuery}"`
                    })
                    return
                }
            }

            // Create embed with player list
            const embed = new EmbedBuilder()
                .setColor(0x7C3AED)
                .setTitle(`📋 Joueurs du clan ${config.clan.name}`)
                .setDescription(searchQuery ? `Résultats pour "${searchQuery}" (${filteredPlayers.length})` : `${filteredPlayers.length} joueurs au total`)

            // Split into chunks of 25 (Discord field limit)
            const chunkSize = 25
            for (let i = 0; i < filteredPlayers.length; i += chunkSize) {
                const chunk = filteredPlayers.slice(i, i + chunkSize)
                const fieldValue = chunk
                    .map(p => `**${p.name}** - \`${p.tag}\` ${p.townHallLevel ? `(HDV ${p.townHallLevel})` : ''}`)
                    .join('\n')

                embed.addFields({
                    name: i === 0 ? '​' : '​', // Zero-width space for continuation
                    value: fieldValue || 'Aucun joueur'
                })
            }

            embed.setFooter({ text: 'Utilisez /list <nom> pour rechercher un joueur spécifique' })

            await interaction.editReply({ embeds: [embed] })

        } catch (error) {
            console.error('[Bot] List error:', error)
            await interaction.editReply({ content: '❌ Erreur lors de la récupération des joueurs.' })
        }
    },
}

commands.set('connect', connectCommand)
commands.set('setup', setupCommand)
commands.set('claim', claimCommand)
commands.set('verify', verifyCommand)
commands.set('notify', notifyCommand)
commands.set('clan', clanCommand)
commands.set('stats', statsCommand)
commands.set('help', helpCommand)
commands.set('config', configCommand)
commands.set('list', listCommand)

// ============ EVENT HANDLERS ============

// Auto-detect screenshots in verification channel
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return

    // Check if message has attachments
    if (message.attachments.size === 0) return

    console.log('[Bot] 📸 Image détectée de:', message.author.username, 'dans channel:', message.channelId)

    const guildId = message.guildId
    if (!guildId) return

    // Check if this is the verification channel
    const config = await prisma.discordConfig.findUnique({
        where: { guildId }
    })

    if (!config || !config.verificationChannelId) {
        console.log('[Bot] ❌ Pas de config ou verificationChannelId')
        return
    }

    // Find pending claim for this user (from any channel in the server)
    const claim = await prisma.playerClaim.findFirst({
        where: {
            discordUserId: message.author.id,
            guildId,
            status: 'pending',
            screenshotUrl: null // Only claims without screenshot
        },
        include: { player: true }
    })

    if (!claim) {
        console.log('[Bot] ❌ Pas de claim pending trouvé pour:', message.author.username)
        return
    }

    console.log('[Bot] ✅ Claim trouvé:', claim.id, 'pour joueur:', claim.player.name)

    // NOTE: We accept screenshots from ANY channel because the claimChannels Map
    // is cleared on bot restart. To fix this properly, we'd need to store the
    // channelId in the database, not in memory.

    console.log('[Bot] ✅ Screenshot accepté ! Mise à jour...')

    const attachment = message.attachments.first()
    if (!attachment) return

    // Save screenshot URL
    await prisma.playerClaim.update({
        where: { id: claim.id },
        data: { screenshotUrl: attachment.url }
    })

    // Don't delete user's message - keep it for valid URL
    // The screenshot URL needs to remain accessible

    // Find and update claim message in VERIFICATION channel
    const channel = await client.channels.fetch(config.verificationChannelId!) as TextChannel

    // Find the claim message and update it
    const messages = await channel.messages.fetch({ limit: 50 })
    console.log('[Bot] 🔍 Recherche du message dans', channel.name, '- Nb messages:', messages.size)
    const claimMessage = messages.find(m =>
        m.author.id === client.user?.id &&
        m.embeds[0]?.footer?.text === `Claim ID: ${claim.id}`
    )

    console.log('[Bot] Message trouvé ?', claimMessage ? '✅ OUI' : '❌ NON')

    if (claimMessage) {
        const originalEmbed = claimMessage.embeds[0]
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setImage(attachment.url)
            .setFields(
                originalEmbed.fields.filter(f => f.name !== '📋 Status')
            )
            .addFields({
                name: '📋 Status',
                value: '⏳ En attente de vérification',
                inline: false
            })

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

        await claimMessage.edit({
            content: `📸 Screenshot reçu de <@${message.author.id}> !`,
            embeds: [updatedEmbed],
            components: [row]
        })

        // Confirm to user via DM
        try {
            const user = await client.users.fetch(message.author.id)
            await user.send(`✅ **Screenshot reçu !**\n\nVotre capture d'écran pour **${claim.player.name}** a été ajoutée à votre demande.\n\nUn admin la vérifiera sous peu. 👍`)
        } catch (err) {
            console.log('[Bot] Could not DM user')
        }
    }
})

client.once('ready', async () => {
    console.log(`[Bot] ✅ Connecté en tant que ${client.user?.tag}`)

    client.user?.setActivity('Clash of Clans', { type: ActivityType.Watching })

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)
    const commandsData = Array.from(commands.values()).map(cmd => cmd.data.toJSON())

    try {
        console.log('[Bot] 📝 Enregistrement des commandes...')

        // Register to each guild (NOT globally to avoid duplicates)
        for (const guild of client.guilds.cache.values()) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guild.id),
                { body: commandsData }
            )
            console.log(`[Bot] ✅ Commandes enregistrées pour: ${guild.name}`)
        }

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

                // Update the embed to show rejection
                const originalEmbed = buttonInteraction.message.embeds[0]
                const updatedEmbed = EmbedBuilder.from(originalEmbed)
                    .setColor(0xEF4444) // Red color
                    .setFields(
                        originalEmbed.fields.filter(f => f.name !== '📋 Status')
                    )
                    .addFields({
                        name: '📋 Status',
                        value: `❌ Rejeté par <@${buttonInteraction.user.id}>`,
                        inline: false
                    })

                await buttonInteraction.update({
                    embeds: [updatedEmbed],
                    components: [],
                })
            }
        }
    }

    // Handle select menu interactions (claim player selection)
    if (interaction.isStringSelectMenu()) {
        const selectInteraction = interaction as StringSelectMenuInteraction
        const customId = selectInteraction.customId

        if (customId.startsWith('claim_select_')) {
            await selectInteraction.deferReply({ ephemeral: true })

            const selectedTag = selectInteraction.values[0]
            const userId = selectInteraction.user.id
            const username = selectInteraction.user.username
            const guildId = selectInteraction.guildId!

            const config = await prisma.discordConfig.findUnique({
                where: { guildId },
                include: { clan: true }
            })

            if (!config) {
                await selectInteraction.editReply({ content: '❌ Configuration non trouvée.' })
                return
            }

            // Get player
            const player = await prisma.player.findUnique({
                where: { tag: selectedTag }
            })

            if (!player) {
                await selectInteraction.editReply({ content: '❌ Joueur non trouvé.' })
                return
            }

            // Delete any rejected claims for this user+player combination
            await prisma.playerClaim.deleteMany({
                where: {
                    discordUserId: userId,
                    playerId: player.id,
                    guildId,
                    status: 'rejected'
                }
            })

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

            // Store the channel ID where this claim was created
            claimChannels.set(claim.id, selectInteraction.channelId)

            // Send message in VERIFICATION CHANNEL
            const verificationChannel = await selectInteraction.guild!.channels.fetch(config.verificationChannelId!) as TextChannel

            if (verificationChannel) {
                const claimEmbed = new EmbedBuilder()
                    .setColor(0xFACC15)
                    .setTitle('🆕 Nouvelle demande de revendication')
                    .setDescription(`<@${userId}> souhaite revendiquer le profil **${player.name}**`)
                    .addFields(
                        { name: '👤 Joueur CoC', value: `${player.name} (${player.tag})`, inline: true },
                        { name: '🏠 HDV', value: `${player.townHallLevel || 'N/A'}`, inline: true },
                        { name: '📋 Status', value: '⏳ En attente de screenshot', inline: false },
                    )
                    .setFooter({ text: `Claim ID: ${claim.id}` })
                    .setTimestamp()

                await verificationChannel.send({
                    content: `📸 <@${userId}> doit envoyer un screenshot de **${player.name}**`,
                    embeds: [claimEmbed]
                })
            }

            await selectInteraction.editReply({
                content: `✅ **Demande créée !**\n\nEnvoyez maintenant une capture d'écran de votre profil **${player.name}** ICI (dans ce channel).\n\nLe bot détectera automatiquement votre screenshot et le transférera dans <#${config.verificationChannelId}> ! 👍`
            })
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
