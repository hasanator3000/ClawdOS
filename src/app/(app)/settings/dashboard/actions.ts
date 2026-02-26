'use server'

import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import { setUserSetting, deleteUserSetting } from '@/lib/db/repositories/user-setting.repository'
import { validateAction } from '@/lib/validation'
import {
  dashboardCurrenciesSchema,
  dashboardWeatherCitySchema,
  dashboardTimezoneSchema,
} from '@/lib/validation-schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('dashboard-settings')

export async function saveCurrencyPrefs(data: unknown) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const v = validateAction(dashboardCurrenciesSchema, data)
  if (v.error) return { error: v.error }

  try {
    await withUser(session.userId, (client) =>
      setUserSetting(client, 'dashboard:currencies', v.data)
    )
    return { success: true }
  } catch (error) {
    log.error('Save currency prefs failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to save currency preferences' }
  }
}

export async function saveWeatherCity(city: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  // Allow empty string to reset to default
  if (!city.trim()) {
    try {
      await withUser(session.userId, (client) =>
        deleteUserSetting(client, 'dashboard:weather_city')
      )
      return { success: true }
    } catch (error) {
      log.error('Delete weather city failed', { error: error instanceof Error ? error.message : String(error) })
      return { error: 'Failed to reset weather city' }
    }
  }

  const v = validateAction(dashboardWeatherCitySchema, city.trim())
  if (v.error) return { error: v.error }

  try {
    await withUser(session.userId, (client) =>
      setUserSetting(client, 'dashboard:weather_city', v.data)
    )
    return { success: true }
  } catch (error) {
    log.error('Save weather city failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to save weather city' }
  }
}

export async function saveTimezone(tz: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  // Allow empty string to reset to default
  if (!tz.trim()) {
    try {
      await withUser(session.userId, (client) =>
        deleteUserSetting(client, 'dashboard:timezone')
      )
      return { success: true }
    } catch (error) {
      log.error('Delete timezone failed', { error: error instanceof Error ? error.message : String(error) })
      return { error: 'Failed to reset timezone' }
    }
  }

  const v = validateAction(dashboardTimezoneSchema, tz)
  if (v.error) return { error: v.error }

  try {
    await withUser(session.userId, (client) =>
      setUserSetting(client, 'dashboard:timezone', v.data)
    )
    return { success: true }
  } catch (error) {
    log.error('Save timezone failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to save timezone' }
  }
}
