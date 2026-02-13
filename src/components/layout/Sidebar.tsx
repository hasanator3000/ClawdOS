import SidebarClient from './SidebarClient'
import { getSession } from '@/lib/auth/session'

export default async function Sidebar() {
  const session = await getSession()

  return <SidebarClient username={session.username} />
}
