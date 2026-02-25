import { NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

let buildId: string | null = null

function getBuildId(): string {
  if (buildId) return buildId
  try {
    buildId = readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim()
  } catch {
    buildId = 'unknown'
  }
  return buildId
}

export async function GET() {
  return NextResponse.json(
    { buildId: getBuildId() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
