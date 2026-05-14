import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY

export function createResend(): Resend | null {
    if (!resendApiKey) return null
    return new Resend(resendApiKey)
}

export function getFromEmail(): string {
    return process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
}

export function getFromName(): string {
    return process.env.RESEND_FROM_NAME ?? 'NutriCoach'
}
