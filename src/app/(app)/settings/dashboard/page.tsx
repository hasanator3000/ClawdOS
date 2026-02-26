import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import { getUserSettings } from '@/lib/db/repositories/user-setting.repository'
import { DashboardPrefsForm } from './DashboardPrefsForm'

export const dynamic = 'force-dynamic'

const PREF_KEYS = ['dashboard:currencies', 'dashboard:weather_city', 'dashboard:timezone']

export default async function DashboardSettingsPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const settings = await withUser(session.userId, (client) =>
    getUserSettings(client, PREF_KEYS)
  )

  const prefs = Object.fromEntries(settings.map((s) => [s.key, s.value]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard preferences</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Customize your dashboard widgets — currencies, weather, timezone.
        </p>
      </div>

      <DashboardPrefsForm
        currencies={prefs['dashboard:currencies'] as { baseCurrency: string; fiat: string[]; crypto: string[] } | null ?? null}
        weatherCity={prefs['dashboard:weather_city'] as string | null ?? null}
        timezone={prefs['dashboard:timezone'] as string | null ?? null}
      />
    </div>
  )
}
