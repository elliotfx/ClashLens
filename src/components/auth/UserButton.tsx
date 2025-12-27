'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { LogIn, LogOut, User } from 'lucide-react'

export default function UserButton() {
    const { data: session, status } = useSession()

    if (status === 'loading') {
        return (
            <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
        )
    }

    if (!session) {
        return (
            <button
                onClick={() => signIn('google')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all"
            >
                <LogIn className="w-4 h-4" />
                <span>Connexion</span>
            </button>
        )
    }

    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                {session.user?.image ? (
                    <img
                        src={session.user.image}
                        alt={session.user.name || 'User'}
                        className="w-10 h-10 rounded-full border-2 border-purple-500"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                    </div>
                )}
                <div className="hidden md:block">
                    <p className="text-sm font-medium text-white">{session.user?.name}</p>
                    <p className="text-xs text-gray-400">{session.user?.email}</p>
                </div>
            </div>
            <button
                onClick={() => signOut()}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                title="Déconnexion"
            >
                <LogOut className="w-4 h-4" />
            </button>
        </div>
    )
}
