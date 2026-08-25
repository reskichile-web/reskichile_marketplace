interface ProductViewerState {
  loading: boolean
  canEdit: boolean
}

/** Public seller actions must never flash while a persisted owner/admin session
 * is still resolving, and must not coexist with management actions. */
export function showPublicProductActions({ loading, canEdit }: ProductViewerState): boolean {
  return !loading && !canEdit
}

export function showClaimListingsPrompt({
  loading,
  canEdit,
  isCommerceProduct,
}: ProductViewerState & { isCommerceProduct: boolean }): boolean {
  return !isCommerceProduct && showPublicProductActions({ loading, canEdit })
}
