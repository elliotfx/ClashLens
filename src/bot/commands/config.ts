// /config command - Server configuration management
const configCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Gérer la configuration du serveur')
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Supprimer toute la configuration ClashLens (clan, channels, claims)')
        ) as SlashCommandBuilder,
    async execute(interaction) {
        if (!await isAdmin(interaction)) {
            await interaction.reply({ content: '❌ Seuls les administrateurs peuvent utiliser cette commande.', ephemeral: true })
            return
        }

        const subcommand = interaction.options.getSubcommand()
        const guildId = interaction.guildId!
        const guild = interaction.guild!

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
    },
}
