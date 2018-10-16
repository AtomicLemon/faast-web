import BigNumber from 'bignumber.js'
import Wallet from './Wallet'
import { Asset } from 'Types'
import { PaymentTx } from 'Services/Bitcore'

export type Amount = BigNumber

export type TransactionOutput = {
  address: string,
  amount: Amount,
}

export type Transaction = {
  walletId: string,
  type: string,
  outputs: TransactionOutput[],
  assetSymbol: string,
  feeAmount: Amount,
  feeSymbol: string,
  hash: string | null,
  signed: boolean,
  sent: boolean,
  txData?: object | null,
  signedTxData?: any,
}

export type BitcoreTransaction = Transaction & {
  txData?: PaymentTx | null,
  signedTxData?: string | null,
}

export type Balances = {
  [symbol: string]: Amount,
}

export type FeeRate = {
  rate: Amount | number,
  unit: string,
}

export type AssetProvider = () => (Asset[] | { [symbol: string]: Asset })
export type WalletGetter = (id: string) => Wallet | null

export type Web3Receipt = {
  blockNumber: number,
  status: boolean | number | string,
}

export type Receipt = {
  confirmed: boolean,
  succeeded: boolean,
  blockNumber: number,
  raw: object,
}

export type ConnectResult = {
  derivationPath: string,
  getAccount: (index: number) => Promise<Wallet>,
}
