import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { SKILLS } from '@/lib/clawdbot/skills-registry'
import { SkillsList } from './SkillsList'

export const dynamic = 'force-dynamic'

export default async function SkillsPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between pr-12">
        <h1 className="text-xl font-semibold">Skills & Commands</h1>
        <div className="text-sm text-[var(--muted)]">{SKILLS.length} commands available</div>
      </div>

      <div className="text-sm text-[var(--muted)]">
        Все доступные команды Clawdbot. Используйте их в чате для управления системой.
      </div>

      <SkillsList skills={SKILLS} />
    </div>
  )
}
