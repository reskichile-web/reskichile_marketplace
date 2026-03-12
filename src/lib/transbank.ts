import { WebpayPlus, Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment } from 'transbank-sdk'

function getTransaction() {
  // Use integration (sandbox) environment for development
  // Switch to production when going live
  return new WebpayPlus.Transaction(
    new Options(
      IntegrationCommerceCodes.WEBPAY_PLUS,
      IntegrationApiKeys.WEBPAY,
      Environment.Integration
    )
  )
}

export async function createTransaction(
  buyOrder: string,
  sessionId: string,
  amount: number,
  returnUrl: string
) {
  const tx = getTransaction()
  const response = await tx.create(buyOrder, sessionId, amount, returnUrl)
  return response
}

export async function confirmTransaction(token: string) {
  const tx = getTransaction()
  const response = await tx.commit(token)
  return response
}
