'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function ConnectPage() {
    const router = useRouter()
    const { data: session, status } = useSession()
    const [clanTag, setClanTag] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState<any>(null)

    // Redirect to signin if not authenticated (only after loading is complete)
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin?callbackUrl=/connect')
        }
    }, [status, router])

    // Show loading only while checking session
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        )
    }

    // If unauthenticated, useEffect will redirect
    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        )
    }

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess(null)

        try {
            const response = await fetch('/api/clan/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clanTag }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to connect clan')
            }

            setSuccess(data.clan)

            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                router.push(`/dashboard/${encodeURIComponent(data.clan.tag)}`)
            }, 2000)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <Link href="/" className="flex items-center justify-center gap-2 mb-8">
                    <Shield className="w-8 h-8 text-blue-500" />
                    <span className="text-2xl font-bold text-white">ClashLens</span>
                </Link>

                <div className="glassmorphism rounded-xl p-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Connect Your Clan</h1>
                    <p className="text-gray-400 mb-8">
                        Enter your clan tag to start tracking performance and analytics
                    </p>

                    {success ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                                <div>
                                    <p className="text-green-400 font-semibold">Successfully connected!</p>
                                    <p className="text-gray-300 text-sm">{success.name}</p>
                                </div>
                            </div>
                            <p className="text-center text-gray-400 text-sm">
                                Redirecting to dashboard...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleConnect} className="space-y-6">
                            <div>
                                <label htmlFor="clanTag" className="block text-sm font-medium text-gray-300 mb-2">
                                    Clan Tag
                                </label>
                                <input
                                    id="clanTag"
                                    type="text"
                                    value={clanTag}
                                    onChange={(e) => setClanTag(e.target.value)}
                                    placeholder="#ABC123"
                                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={loading}
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    You can find your clan tag in Clash of Clans
                                </p>
                            </div>

                            {error && (
                                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <div className="text-red-400 text-sm">{error}</div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !clanTag}
                                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    'Connect Clan'
                                )}
                            </button>
                        </form>
                    )}
                </div>

                <div className="text-center mt-6">
                    <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
                        ← Back to home
                    </Link>
                </div>
            </div>
        </div>
    )
}
