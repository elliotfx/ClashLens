// Quick script to delete all global Discord commands
// Run with: node scripts/clear-discord-commands.js

const { REST, Routes } = require('discord.js')

// Read environment variables directly
const fs = require('fs')
const path = require('path')

function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env')
    const envContent = fs.readFileSync(envPath, 'utf8')

    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/)
        if (match) {
            const key = match[1].trim()
            const value = match[2].trim().replace(/^["']|["']$/g, '')
            process.env[key] = value
        }
    })
}

async function clearCommands() {
    loadEnv()

    if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
        console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env')
        process.exit(1)
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN)

    try {
        console.log('🗑️  Deleting all global commands...')
        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: [] }
        )
        console.log('✅ Global commands deleted successfully!')

        console.log('\n✅ Done! Restart your bot now.')
        console.log('   The duplicates should disappear.')
    } catch (error) {
        console.error('❌ Error:', error.message)
    }
}

clearCommands()
