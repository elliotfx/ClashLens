import axios, { AxiosInstance, AxiosError } from 'axios'
import type { CoCClan, CoCPlayer, CoCWar, CoCWarLog } from './types'

export class CoCAPIError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public reason?: string
    ) {
        super(message)
        this.name = 'CoCAPIError'
    }
}

export class CoCClient {
    private client: AxiosInstance
    private maxRetries = 3
    private baseDelay = 1000 // ms

    constructor() {
        const token = process.env.COC_API_TOKEN
        const baseURL = process.env.COC_API_BASE_URL || 'https://api.clashofclans.com/v1'

        if (!token) {
            throw new Error('COC_API_TOKEN is not defined')
        }

        this.client = axios.create({
            baseURL,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
            timeout: 10000,
        })
    }

    /**
     * Normalize a clan/player tag to API format
     */
    normalizeTag(tag: string): string {
        // Remove # if present and convert to uppercase
        let normalized = tag.trim().toUpperCase()
        if (!normalized.startsWith('#')) {
            normalized = '#' + normalized
        }
        // Validate tag format (alphanumeric after #)
        if (!/^#[0-9A-Z]+$/.test(normalized)) {
            throw new CoCAPIError('Invalid tag format. Tags should contain only letters and numbers.')
        }
        return normalized
    }

    /**
     * URL encode a tag for API requests
     */
    encodeTag(tag: string): string {
        return encodeURIComponent(this.normalizeTag(tag))
    }

    /**
     * Request with retry logic and exponential backoff
     */
    private async requestWithRetry<T>(
        url: string,
        attempt = 1
    ): Promise<T> {
        try {
            const response = await this.client.get<T>(url)
            return response.data
        } catch (error) {
            const axiosError = error as AxiosError<{ reason?: string; message?: string }>

            // Log the error
            console.error(`CoC API Error (attempt ${attempt}/${this.maxRetries}):`, {
                url,
                status: axiosError.response?.status,
                reason: axiosError.response?.data?.reason,
                message: axiosError.response?.data?.message,
            })

            // Don't retry on 4xx errors (except 429 rate limit)
            if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
                if (axiosError.response.status === 404) {
                    throw new CoCAPIError('Resource not found', 404, 'notFound')
                }
                if (axiosError.response.status === 403) {
                    throw new CoCAPIError('Access denied. This resource may be private.', 403, 'accessDenied')
                }
                if (axiosError.response.status !== 429) {
                    throw new CoCAPIError(
                        axiosError.response.data?.message || 'Bad request',
                        axiosError.response.status,
                        axiosError.response.data?.reason
                    )
                }
            }

            // Retry on 5xx errors or 429 rate limit
            if (attempt < this.maxRetries) {
                const delay = this.baseDelay * Math.pow(2, attempt - 1)
                console.log(`Retrying in ${delay}ms...`)
                await new Promise(resolve => setTimeout(resolve, delay))
                return this.requestWithRetry<T>(url, attempt + 1)
            }

            throw new CoCAPIError(
                'Failed to fetch data from Clash of Clans API after retries',
                axiosError.response?.status
            )
        }
    }

    /**
     * Get clan information
     */
    async getClan(tag: string): Promise<CoCClan> {
        const encodedTag = this.encodeTag(tag)
        return this.requestWithRetry<CoCClan>(`/clans/${encodedTag}`)
    }

    /**
     * Get player information
     */
    async getPlayer(tag: string): Promise<CoCPlayer> {
        const encodedTag = this.encodeTag(tag)
        return this.requestWithRetry<CoCPlayer>(`/players/${encodedTag}`)
    }

    /**
     * Get current war information
     */
    async getCurrentWar(clanTag: string): Promise<CoCWar> {
        const encodedTag = this.encodeTag(clanTag)
        return this.requestWithRetry<CoCWar>(`/clans/${encodedTag}/currentwar`)
    }

    /**
     * Get war log (may be private)
     */
    async getWarLog(clanTag: string): Promise<CoCWarLog> {
        const encodedTag = this.encodeTag(clanTag)
        return this.requestWithRetry<CoCWarLog>(`/clans/${encodedTag}/warlog`)
    }
}

// Singleton instance
export const cocClient = new CoCClient()
