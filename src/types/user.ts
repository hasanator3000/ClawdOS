export type User = {
  id: string
  username: string
  telegramUserId: string | null
}

export type UserProfile = {
  telegramUserId: string | null
  passwordUpdatedAt: string | null
  createdAt: string
}
