import type { InsightsExpense } from '@/lib/insightsTypes'

export type NoteTheme = {
  keyword: string
  count: number
}

const maxThemes = 5
const minWordLength = 3

// Small stop-word list keeps note theme extraction cheap and deterministic.
const stopWords = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'was',
  'are',
  'you',
  'your',
  'our',
  'not',
  'but',
  'had',
  'has',
  'have',
  'all',
  'any',
  'can',
  'did',
  'get',
  'got',
  'its',
  'may',
  'one',
  'out',
  'pay',
  'paid',
  'via',
])

function tokenizeNote(note: string | null | undefined) {
  if (!note?.trim()) {
    return []
  }

  return note
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= minWordLength && !stopWords.has(word))
}

/** Deterministic frequent keywords from notes — themes only, never full note text. */
export function extractNoteThemes(expenses: InsightsExpense[]): NoteTheme[] {
  const counts = new Map<string, number>()

  for (const expense of expenses) {
    const seenInNote = new Set<string>()

    for (const word of tokenizeNote(expense.note)) {
      if (seenInNote.has(word)) {
        continue
      }

      seenInNote.add(word)
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxThemes)
    .map(([keyword, count]) => ({ keyword, count }))
}
