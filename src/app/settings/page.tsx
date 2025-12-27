import { redirect } from 'next/navigation'

export default function GlobalSettingsPage() {
    // Redirect to home page since we don't have global settings anymore
    redirect('/')
}
