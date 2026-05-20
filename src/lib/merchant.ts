/** Display-only label; does not normalize or affect stored data. */
export function formatMerchantDisplay(
  merchant: string | null | undefined
): string {
  return merchant?.trim() ?? ''
}

type MerchantLabelExpense = {
  merchant: string | null
  normalized_merchant: string | null
  expense_date: string
}

/** Most recent raw `merchant` label per `normalized_merchant` (for UI only). */
export function buildMerchantDisplayLookup<T extends MerchantLabelExpense>(
  expenses: T[]
) {
  const latestByNormalized = new Map<
    string,
    { merchant: string; expense_date: string }
  >()

  for (const expense of expenses) {
    if (!expense.normalized_merchant) {
      continue
    }

    const merchant = formatMerchantDisplay(expense.merchant)

    if (!merchant) {
      continue
    }

    const existing = latestByNormalized.get(expense.normalized_merchant)

    if (!existing || expense.expense_date > existing.expense_date) {
      latestByNormalized.set(expense.normalized_merchant, {
        merchant,
        expense_date: expense.expense_date,
      })
    }
  }

  return Object.fromEntries(
    [...latestByNormalized.entries()].map(([normalized, value]) => [
      normalized,
      value.merchant,
    ])
  )
}

export function resolveMerchantDisplay(
  lookup: Record<string, string>,
  normalized_merchant: string
) {
  return lookup[normalized_merchant] ?? normalized_merchant
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
