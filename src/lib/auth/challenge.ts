import { createChallenge, consumeChallenge, type ChallengeKind } from '@/lib/db/repositories/auth-challenge.repository'

function generateCode(len = 6): string {
  const digits = '0123456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += digits[Math.floor(Math.random() * digits.length)]
  }
  return out
}

export async function createAuthChallenge(userId: string, kind: ChallengeKind) {
  const code = generateCode(6)
  const { id, expiresAt } = await createChallenge(userId, kind, code)
  return { id, code, expiresAt }
}

export async function consumeAuthChallenge(id: string, code: string, kind: ChallengeKind) {
  return consumeChallenge(id, code, kind)
}

export type { ChallengeKind }
