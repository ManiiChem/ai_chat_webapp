import type { ConversationSummary } from "@/lib/api"

// new conversations store an ISO timestamp, older ones stored the browsers locale string (like "1/1/2026, 10:19:54 PM")
export function parseDate(rawDate: string): Date | null {
  if (!rawDate) return null
  const parsed = new Date(rawDate)
  return isNaN(parsed.getTime()) ? null : parsed
}

export function formatDate(rawDate: string): string {
  const parsed = parseDate(rawDate)
  if (parsed) return parsed.toLocaleDateString()
  return rawDate.split(",")[0]
}

export type ConversationGroup = {
  label: string
  conversations: ConversationSummary[]
}

const GROUP_LABELS = ["Today", "Yesterday", "Previous 7 days", "Older"]

// splits the list (already newest first) into the date sections the sidebar shows
export function groupByDate(
  conversations: ConversationSummary[]
): ConversationGroup[] {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const dayInMs = 24 * 60 * 60 * 1000

  const groups: ConversationGroup[] = GROUP_LABELS.map((label) => ({
    label,
    conversations: [],
  }))

  for (const conversation of conversations) {
    const date = parseDate(conversation.date)
    const daysAgo = date
      ? Math.ceil((startOfToday.getTime() - date.getTime()) / dayInMs)
      : Infinity

    if (daysAgo <= 0) groups[0].conversations.push(conversation)
    else if (daysAgo === 1) groups[1].conversations.push(conversation)
    else if (daysAgo <= 7) groups[2].conversations.push(conversation)
    else groups[3].conversations.push(conversation) // dates that cant be read end up here too
  }

  return groups.filter((group) => group.conversations.length > 0)
}
