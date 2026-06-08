/** Row shape returned by insights expense queries. */
export type InsightsExpense = {
  amount: number
  category: string
  expense_date: string
  normalized_merchant: string | null
  /** Used only for deterministic keyword themes; never sent to OpenAI verbatim. */
  note?: string | null
}
