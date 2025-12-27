import Link from 'next/link'
import { ArrowRight, BarChart3, Users, Trophy } from 'lucide-react'
import UserButton from '@/components/auth/UserButton'
import UserClansSection from '@/components/home/UserClansSection'

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black">
            {/* Top Navigation */}
            <nav className="absolute top-0 left-0 right-0 z-10 p-6">
                <div className="container mx-auto flex justify-end">
                    <UserButton />
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-3xl"></div>

                <div className="relative container mx-auto px-4 py-24">
                    <div className="text-center max-w-4xl mx-auto">
                        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                            ClashLens
                        </h1>
                        <p className="text-2xl text-gray-300 mb-4">
                            Advanced Analytics for Clash of Clans
                        </p>
                        <p className="text-lg text-gray-400 mb-12">
                            Track your clan&apos;s performance, analyze player progression, and unlock deep insights with powerful data visualization
                        </p>

                        <div className="flex gap-4 justify-center flex-wrap">
                            <Link
                                href="/connect"
                                className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105"
                            >
                                Connect Your Clan
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link
                                href="/explore"
                                className="group inline-flex items-center gap-2 border-2 border-gray-600 hover:border-purple-500 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all hover:bg-gray-800/50"
                            >
                                🔍 Explorer un Clan
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Connected Clans Section - Only shows for authenticated users */}
            <UserClansSection />

            {/* Features Section */}
            <section className="py-24 container mx-auto px-4">
                <h2 className="text-4xl font-bold text-center mb-16 text-white">
                    Everything You Need to Manage Your Clan
                </h2>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    <div className="glassmorphism rounded-xl p-8 hover:scale-105 transition-transform">
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mb-6">
                            <BarChart3 className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-white">Real-time Analytics</h3>
                        <p className="text-gray-400">
                            Track trophy progression, donation patterns, and war performance with beautiful, intuitive dashboards updated automatically.
                        </p>
                    </div>

                    <div className="glassmorphism rounded-xl p-8 hover:scale-105 transition-transform">
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center mb-6">
                            <Users className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-white">Player Insights</h3>
                        <p className="text-gray-400">
                            Discover top performers with our IRJ scoring system. Identify inactive members and track individual player journeys over time.
                        </p>
                    </div>

                    <div className="glassmorphism rounded-xl p-8 hover:scale-105 transition-transform">
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center mb-6">
                            <Trophy className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-white">Discord Integration</h3>
                        <p className="text-gray-400">
                            Get clan updates directly in Discord. Automated summaries, player stats, and performance alerts sent to your server.
                        </p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 container mx-auto px-4">
                <div className="glassmorphism rounded-2xl p-12 max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl font-bold mb-6 text-white">
                        Ready to Level Up Your Clan?
                    </h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Join hundreds of clans already using ClashLens to dominate the competition
                    </p>
                    <Link
                        href="/auth/signin"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105"
                    >
                        Get Started Now
                        <ArrowRight />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-800 py-8">
                <div className="container mx-auto px-4 text-center text-gray-400">
                    <p>© 2025 ClashLens. Built with Next.js and powered by the Clash of Clans API.</p>
                </div>
            </footer>
        </div>
    )
}
