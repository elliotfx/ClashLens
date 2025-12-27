import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface KPICardProps {
    title: string
    value: string | number
    subtitle?: string
    icon?: LucideIcon
    trend?: {
        value: number
        label: string
        positive?: boolean
    }
    className?: string
}

export default function KPICard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    className,
}: KPICardProps) {
    return (
        <div className={cn('glassmorphism rounded-xl p-6', className)}>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-sm text-gray-400 mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-white">{value}</h3>
                    {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
                </div>
                {Icon && (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                )}
            </div>

            {trend && (
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            'text-sm font-semibold',
                            trend.positive !== false && trend.value > 0
                                ? 'text-green-400'
                                : trend.value < 0
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                        )}
                    >
                        {trend.value > 0 ? '+' : ''}
                        {trend.value}
                    </span>
                    <span className="text-xs text-gray-500">{trend.label}</span>
                </div>
            )}
        </div>
    )
}
