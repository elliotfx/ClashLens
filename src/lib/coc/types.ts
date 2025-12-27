export interface CoCClan {
    tag: string
    name: string
    type: string
    description?: string
    location?: {
        id: number
        name: string
        isCountry: boolean
    }
    badgeUrls: {
        small: string
        medium: string
        large: string
    }
    clanLevel: number
    clanPoints: number
    clanVersusPoints: number
    requiredTrophies: number
    warFrequency: string
    warWinStreak: number
    warWins: number
    warTies?: number
    warLosses?: number
    isWarLogPublic: boolean
    members: number
    memberList?: CoCClanMember[]
}

export interface CoCClanMember {
    tag: string
    name: string
    role: string
    expLevel: number
    league?: {
        id: number
        name: string
        iconUrls: {
            small: string
            tiny: string
            medium: string
        }
    }
    trophies: number
    versusTrophies: number
    clanRank: number
    previousClanRank: number
    donations: number
    donationsReceived: number
}

export interface CoCPlayer {
    tag: string
    name: string
    townHallLevel: number
    townHallWeaponLevel?: number
    expLevel: number
    trophies: number
    bestTrophies: number
    warStars: number
    attackWins: number
    defenseWins: number
    builderHallLevel?: number
    versusTrophies?: number
    bestVersusTrophies?: number
    versusBattleWins?: number
    role?: string
    donations: number
    donationsReceived: number
    clan?: {
        tag: string
        name: string
        clanLevel: number
        badgeUrls: {
            small: string
            medium: string
            large: string
        }
    }
    league?: {
        id: number
        name: string
        iconUrls: {
            small: string
            tiny: string
            medium: string
        }
    }
    achievements?: Array<{
        name: string
        stars: number
        value: number
        target: number
        info: string
        completionInfo: string | null
        village: string
    }>
    labels?: Array<{
        id: number
        name: string
        iconUrls: {
            small: string
            medium: string
        }
    }>
    troops?: any[]
    heroes?: any[]
    spells?: any[]
}

export interface CoCWar {
    state: string // 'inWar' | 'preparation' | 'warEnded' | 'notInWar'
    teamSize: number
    attacksPerMember: number
    preparationStartTime: string
    startTime: string
    endTime: string
    clan: {
        tag: string
        name: string
        badgeUrls: {
            small: string
            medium: string
            large: string
        }
        clanLevel: number
        attacks?: number
        stars: number
        destructionPercentage: number
        members?: Array<{
            tag: string
            name: string
            townhallLevel: number
            mapPosition: number
            opponentAttacks?: number
            bestOpponentAttack?: any
            attacks?: Array<{
                order: number
                attackerTag: string
                defenderTag: string
                stars: number
                destructionPercentage: number
                duration: number
            }>
        }>
    }
    opponent: {
        tag: string
        name: string
        badgeUrls: {
            small: string
            medium: string
            large: string
        }
        clanLevel: number
        attacks?: number
        stars: number
        destructionPercentage: number
        members?: Array<{
            tag: string
            name: string
            townhallLevel: number
            mapPosition: number
            opponentAttacks?: number
            bestOpponentAttack?: any
        }>
    }
}

export interface CoCWarLog {
    items: Array<{
        result: string
        endTime: string
        teamSize: number
        attacksPerMember?: number
        clan: {
            tag: string
            name: string
            badgeUrls: {
                small: string
                medium: string
                large: string
            }
            clanLevel: number
            attacks?: number
            stars: number
            destructionPercentage: number
            expEarned?: number
        }
        opponent: {
            tag: string
            name: string
            badgeUrls: {
                small: string
                medium: string
                large: string
            }
            clanLevel: number
            stars: number
            destructionPercentage: number
        }
    }>
    paging?: {
        cursors: {
            after?: string
            before?: string
        }
    }
}
