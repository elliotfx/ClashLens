'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

interface Clan {
    tag: string
    name: string
    level: number
    members: number
}

export default function UserClansSection() {
    const { data: session, status } = useSession()
    const [clans, setClans] = useState<Clan[]>([])
    const [loading, setLoading] = useState(true)
    const [removing, setRemoving] = useState<string | null>(null)

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.id) {
            fetchClans()
        } else if (status !== 'loading') {
            setLoading(false)
        }
    }, [status, session])

    async function fetchClans() {
        try {
            const res = await fetch('/api/user/clans')
            const data = await res.json()
            setClans(data.clans || [])
        } catch {
            // ignore
        } finally {
            setLoading(false)
        }
    }

    async function handleDisconnect(clanTag: string, e: React.MouseEvent) {
        e.preventDefault()
        e.stopPropagation()

        if (!confirm('Voulez-vous vraiment déconnecter ce clan ?')) return

        setRemoving(clanTag)
        try {
            const res = await fetch('/api/clan/disconnect', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clanTag }),
            })

            if (res.ok) {
                setClans(clans.filter(c => c.tag !== clanTag))
            }
        } catch {
            // ignore
        } finally {
            setRemoving(null)
        }
    }

    // Don't show if not authenticated
    if (status !== 'authenticated' || !session) {
        return null
    }

    // Loading state
    if (loading) {
        return (
            <section className="py-12 container mx-auto px-4">
                <h2 className="text-2xl font-bold text-center mb-8 text-white">
                    📊 Mes Clans
                </h2>
                <div className="flex justify-center">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </section>
        )
    }

    // No clans yet
    if (clans.length === 0) {
        return (
            <section className="py-12 container mx-auto px-4">
                <h2 className="text-2xl font-bold text-center mb-8 text-white">
                    📊 Mes Clans
                </h2>
                <div className="text-center">
                    <p className="text-gray-400 mb-4">Vous n'avez pas encore connecté de clan.</p>
                    <Link
                        href="/connect"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:from-blue-600 hover:to-purple-700 transition-all"
                    >
                        + Ajouter un clan
                    </Link>
                </div>
            </section>
        )
    }

    return (
        <section className="py-12 container mx-auto px-4">
            <div className="flex items-center justify-center gap-4 mb-8">
                <h2 className="text-2xl font-bold text-white">📊 Mes Clans</h2>
                <Link
                    href="/connect"
                    className="text-sm px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                >
                    + Ajouter
                </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {clans.map((clan) => (
                    <div key={clan.tag} className="relative group">
                        <Link
                            href={`/dashboard/${encodeURIComponent(clan.tag)}`}
                            className="block glassmorphism rounded-xl p-6 hover:scale-105 transition-transform cursor-pointer"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">{clan.name}</h3>
                            <p className="text-gray-400 text-sm mb-3">{clan.tag}</p>
                            <div className="flex gap-4 text-sm">
                                <span className="text-gray-300">⭐ Level {clan.level}</span>
                                <span className="text-gray-300">👥 {clan.members} members</span>
                            </div>
                        </Link>
                        <button
                            onClick={(e) => handleDisconnect(clan.tag, e)}
                            disabled={removing === clan.tag}
                            className="absolute top-2 right-2 p-2 rounded-full bg-red-600/80 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                            title="Déconnecter ce clan"
                        >
                            {removing === clan.tag ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <X className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                ))}
            </div>
        </section>
    )
}
