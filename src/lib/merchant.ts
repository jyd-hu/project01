/** Display-only label; does not normalize or affect stored data. */
export function formatMerchantDisplay(
  merchant: string | null | undefined
): string {
  return merchant?.trim() ?? ''
}

const duplicateWindowMs = 2 * 60 * 1000

export function isDuplicateExpense(
  expenses: Array<{
    normalized_merchant: string | null
    amount: number
    expense_date: string
    created_at: string
  }>,
  candidate: {
    normalized_merchant: string | null
    amount: number
    expense_date: string
  },
  nowMs = Date.now()
) {
  if (!candidate.normalized_merchant) {
    return false
  }

  return expenses.some((expense) => {
    if (expense.normalized_merchant !== candidate.normalized_merchant) {
      return false
    }

    if (expense.amount !== candidate.amount) {
      return false
    }

    if (expense.expense_date !== candidate.expense_date) {
      return false
    }

    const createdAtMs = new Date(expense.created_at).getTime()

    if (!Number.isFinite(createdAtMs)) {
      return false
    }

    return nowMs - createdAtMs <= duplicateWindowMs
  })
}

export function groupAmountsByNormalizedMerchant<
  T extends { amount: number; normalized_merchant: string | null },
>(expenses: T[]) {
  return expenses.reduce<Record<string, number>>((totals, expense) => {
    if (!expense.normalized_merchant) {
      return totals
    }

    totals[expense.normalized_merchant] =
      (totals[expense.normalized_merchant] ?? 0) + expense.amount
    return totals
  }, {})
}
