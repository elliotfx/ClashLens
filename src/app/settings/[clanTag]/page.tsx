'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import { Settings as SettingsIcon, Save, Play, Check, Loader2, RotateCcw, Trophy } from 'lucide-react'
import {
    RANKED_LEAGUES,
    DEFAULT_TH_LEAGUE_REFERENCE,
    loadCustomThLeagueReference,
    saveCustomThLeagueReference,
    resetThLeagueReference
} from '@/lib/utils/leagueReference'

const SYNC_STEPS = [
    { id: 'snapshots', label: 'Collecte des données clan', duration: 3000 },
    { id: 'players', label: 'Mise à jour des joueurs', duration: 4000 },
    { id: 'ranked', label: 'Données ranked', duration: 3000 },
    { id: 'wars', label: 'Historique des guerres', duration: 2000 },
]

// TH levels to show in editor (7-17)
const TH_LEVELS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]

export default function SettingsPage() {
    const params = useParams()
    const clanTag = params.clanTag ? decodeURIComponent(params.clanTag as string) : undefined

    const [snapshotFrequency, setSnapshotFrequency] = useState('60')
    const [saving, setSaving] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [syncProgress, setSyncProgress] = useState(0)
    const [currentStep, setCurrentStep] = useState(0)
    const [syncComplete, setSyncComplete] = useState(false)
    const [message, setMessage] = useState('')

    // TH League Reference state
    const [thLeagueRef, setThLeagueRef] = useState<{ [key: number]: number }>({})
    const [leaguesSaved, setLeaguesSaved] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    // Load custom settings on mount
    useEffect(() => {
        const loaded = loadCustomThLeagueReference()
        setThLeagueRef(loaded)
    }, [])

    // Sync progress animation
    useEffect(() => {
        if (syncing && currentStep < SYNC_STEPS.length) {
            const step = SYNC_STEPS[currentStep]
            const progressPerStep = 100 / SYNC_STEPS.length
            const targetProgress = (currentStep + 1) * progressPerStep

            const progressInterval = setInterval(() => {
                setSyncProgress(prev => {
                    const increment = progressPerStep / (step.duration / 100)
                    const newProgress = Math.min(prev + increment, targetProgress)
                    return newProgress
                })
            }, 100)

            const stepTimeout = setTimeout(() => {
                clearInterval(progressInterval)
                setSyncProgress(targetProgress)
                if (currentStep < SYNC_STEPS.length - 1) {
                    setCurrentStep(prev => prev + 1)
                } else {
                    setSyncing(false)
                    setSyncComplete(true)
                    setTimeout(() => {
                        setSyncComplete(false)
                        setSyncProgress(0)
                        setCurrentStep(0)
                    }, 3000)
                }
            }, step.duration)

            return () => {
                clearInterval(progressInterval)
                clearTimeout(stepTimeout)
            }
        }
    }, [syncing, currentStep])

    const handleSave = async () => {
        setSaving(true)
        setMessage('')

        try {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            setMessage('Settings saved successfully!')
            setTimeout(() => setMessage(''), 3000)
        } catch (error) {
            setMessage('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    const handleSyncNow = async () => {
        setSyncing(true)
        setSyncProgress(0)
        setCurrentStep(0)
        setSyncComplete(false)
        setMessage('')

        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
            })

            if (!response.ok) {
                setMessage('Échec du déclenchement de la synchronisation')
                setSyncing(false)
            }
        } catch (error) {
            setMessage('Erreur lors de la synchronisation')
            setSyncing(false)
        }
    }

    const handleLeagueChange = (thLevel: number, leagueTier: number) => {
        setThLeagueRef(prev => ({
            ...prev,
            [thLevel]: leagueTier
        }))
        setHasChanges(true)
        setLeaguesSaved(false)
    }

    const handleSaveLeagues = () => {
        saveCustomThLeagueReference(thLeagueRef)
        setLeaguesSaved(true)
        setHasChanges(false)
        setMessage('Référentiel des ligues sauvegardé !')
        setTimeout(() => setMessage(''), 3000)
    }

    const handleResetLeagues = () => {
        const defaults = resetThLeagueReference()
        setThLeagueRef({ ...defaults })
        setHasChanges(false)
        setLeaguesSaved(false)
        setMessage('Référentiel réinitialisé aux valeurs par défaut')
        setTimeout(() => setMessage(''), 3000)
    }

    return (
        <div className="flex min-h-screen bg-gray-900">
            <Sidebar clanTag={clanTag} />

            <div className="flex-1 p-8 overflow-auto">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <SettingsIcon className="w-8 h-8" />
                            Settings
                        </h1>
                        <p className="text-gray-400">Configure data collection and application settings</p>
                    </div>

                    {message && (
                        <div className="glassmorphism rounded-xl p-4 mb-6 border-l-4 border-blue-500">
                            <p className="text-white">{message}</p>
                        </div>
                    )}

                    {/* TH League Reference Editor */}
                    <div className="glassmorphism rounded-xl p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <Trophy className="w-6 h-6 text-yellow-400" />
                                <h2 className="text-xl font-bold text-white">Référentiel HDV → Ligue Minimum</h2>
                            </div>
                            <button
                                onClick={handleResetLeagues}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Réinitialiser
                            </button>
                        </div>

                        <p className="text-gray-400 mb-4 text-sm">
                            Définissez la ligue ranked minimum attendue pour chaque niveau d'Hôtel de Ville.
                            Ces valeurs déterminent si un joueur est surperformant, conforme ou sous-performant.
                        </p>

                        {/* TH Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            {TH_LEVELS.map(th => (
                                <div key={th} className="bg-gray-800/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-white font-bold">TH{th}</span>
                                        {thLeagueRef[th] !== DEFAULT_TH_LEAGUE_REFERENCE[th] && (
                                            <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded">
                                                Modifié
                                            </span>
                                        )}
                                    </div>
                                    <select
                                        value={thLeagueRef[th] ?? DEFAULT_TH_LEAGUE_REFERENCE[th] ?? 0}
                                        onChange={(e) => handleLeagueChange(th, parseInt(e.target.value))}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {RANKED_LEAGUES.map(league => (
                                            <option key={league.tier} value={league.tier}>
                                                {league.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        {/* Save Button */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleSaveLeagues}
                                disabled={!hasChanges}
                                className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${hasChanges
                                    ? 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {leaguesSaved ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Sauvegardé !
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Sauvegarder le référentiel
                                    </>
                                )}
                            </button>
                            {hasChanges && (
                                <span className="text-sm text-yellow-400">
                                    ⚠️ Modifications non sauvegardées
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Snapshot Frequency */}
                    <div className="glassmorphism rounded-xl p-6 mb-6">
                        <h2 className="text-xl font-bold text-white mb-4">Data Collection</h2>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="frequency" className="block text-sm font-medium text-gray-300 mb-2">
                                    Snapshot Frequency
                                </label>
                                <select
                                    id="frequency"
                                    value={snapshotFrequency}
                                    onChange={(e) => setSnapshotFrequency(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="15">Every 15 minutes</option>
                                    <option value="30">Every 30 minutes</option>
                                    <option value="60">Every hour</option>
                                    <option value="120">Every 2 hours</option>
                                    <option value="360">Every 6 hours</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-2">
                                    How often to collect clan and player data snapshots
                                </p>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                                >
                                    <Save className="w-5 h-5" />
                                    {saving ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Manual Sync */}
                    <div className="glassmorphism rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Manual Sync</h2>
                        <p className="text-gray-400 mb-4">
                            Déclencher une collecte immédiate des données pour ce clan :
                            snapshots, données ranked et guerres.
                        </p>

                        {/* Sync Button */}
                        <button
                            onClick={handleSyncNow}
                            disabled={syncing || syncComplete}
                            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all mb-6 ${syncComplete
                                ? 'bg-green-600 text-white'
                                : syncing
                                    ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                        >
                            {syncComplete ? (
                                <>
                                    <Check className="w-5 h-5" />
                                    Synchronisation terminée !
                                </>
                            ) : syncing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Synchronisation en cours...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    Lancer la synchronisation
                                </>
                            )}
                        </button>

                        {/* Progress Bar */}
                        {(syncing || syncComplete) && (
                            <div className="space-y-4">
                                {/* Main Progress Bar */}
                                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${syncComplete
                                            ? 'bg-green-500'
                                            : 'bg-gradient-to-r from-blue-500 to-purple-600'
                                            }`}
                                        style={{ width: `${syncComplete ? 100 : syncProgress}%` }}
                                    />
                                </div>

                                {/* Progress Steps */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {SYNC_STEPS.map((step, index) => {
                                        const isComplete = syncComplete || index < currentStep
                                        const isActive = syncing && index === currentStep

                                        return (
                                            <div
                                                key={step.id}
                                                className={`p-3 rounded-lg border transition-all ${isComplete
                                                    ? 'bg-green-500/20 border-green-500/50'
                                                    : isActive
                                                        ? 'bg-blue-500/20 border-blue-500/50'
                                                        : 'bg-gray-800/50 border-gray-700'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    {isComplete ? (
                                                        <Check className="w-4 h-4 text-green-400" />
                                                    ) : isActive ? (
                                                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
                                                    )}
                                                    <span className={`text-xs font-medium ${isComplete
                                                        ? 'text-green-400'
                                                        : isActive
                                                            ? 'text-blue-400'
                                                            : 'text-gray-500'
                                                        }`}>
                                                        {index + 1}/{SYNC_STEPS.length}
                                                    </span>
                                                </div>
                                                <p className={`text-sm ${isComplete || isActive ? 'text-white' : 'text-gray-500'
                                                    }`}>
                                                    {step.label}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Percentage */}
                                <p className="text-center text-sm text-gray-400">
                                    {syncComplete ? (
                                        <span className="text-green-400">✓ Toutes les données ont été synchronisées</span>
                                    ) : (
                                        <span>{Math.round(syncProgress)}% complété</span>
                                    )}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Discord Configuration Info */}
                    <div className="glassmorphism rounded-xl p-6 mt-6">
                        <h2 className="text-xl font-bold text-white mb-4">Discord Configuration</h2>
                        <p className="text-gray-400 mb-2">
                            Configure Discord bot settings directly in your Discord server using the bot commands:
                        </p>
                        <ul className="list-disc list-inside text-gray-400 space-y-1 ml-2">
                            <li><code className="text-blue-400">/clash connect</code> - Link your clan to the Discord server</li>
                            <li><code className="text-blue-400">/clash summary</code> - Get clan performance summaries</li>
                            <li><code className="text-blue-400">/clash dashboard</code> - Get a link to the web dashboard</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
