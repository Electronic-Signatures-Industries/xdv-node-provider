export interface Ancon {
  contractAddress: string
  files: {
    add: (msg: any, memo: any, amount: any, fee: any) => any
    get: (msg: any, p: any) => any
  }
  metadata: {
    add: (msg: any, memo: any, amount: any, fee: any) => any
    get: (msg: any, p: any) => any
  }
  defaultAccount: any
}

import { Tendermint34Client } from '@cosmjs/tendermint-rpc'
import { registerSchema, validate } from 'class-validator'
import {
  encodeSecp256k1Pubkey,
  EnigmaUtils,
  pubkeyToAddress,
  Secp256k1Pen,
  SigningCosmWasmClient,
} from 'secretjs'
import { KeystoreDbModel, Wallet } from 'xdv-universal-wallet-core'
const Ajv = require('ajv')
const ajv = new Ajv()

const handleMsg = ajv.compile(require('./schema/handle_msg.json'))
const handleAnswer = ajv.compile(require('./schema/handle_answer.json'))
const queryMsg = ajv.compile(require('./schema/query_msg.json'))
const queryAnswer = ajv.compile(require('./schema/query_answer.json'))
export class AnconWallet {
  wallet: Wallet
  contracts: any
  /**
   * Register Msg imports
   */
  constructor() {
    this.wallet = new Wallet({ isWeb: false })
  }

  /**
   * Creates a wallet account
   * @param accountName Account name
   * @param passphrase Passphrase
   */
  async createAccount(accountName: string, passphrase: string) {
    await this.wallet.open(accountName, passphrase)
    await this.wallet.enrollAccount({
      accountName,
    })
  }

  /**
   * Creates a wallet
   * @param accountName Account name
   * @param passphrase Passphrase
   * @returns
   */
  async createWallet(accountName: string, passphrase: string) {
    await this.wallet.open(accountName, passphrase)

    const acct = (await this.wallet.getAccount()) as any
    let walletId: string

    if (acct.keystores.length === 0) {
      walletId = await this.wallet.addWallet()
    } else {
      walletId = acct.keystores[0].walletId
    }

    const wallet = await this.wallet.createES256K({
      passphrase: passphrase,
      walletId: walletId,
    })

    return wallet as any
  }

  /**
   * Imports an existing seed phrase
   * @param accountName Account name
   * @param passphrase Passphrase
   * @param mnemonic Seed phrase
   * @returns
   */
  async importWallet(
    accountName: string,
    passphrase: string,
    mnemonic: string,
  ) {
    await this.wallet.open(accountName, passphrase)

    const acct = (await this.wallet.getAccount()) as any

    if (acct.keystores.length > 0) {
      // already imported
      return this.wallet
    }

    const walletId = await this.wallet.addWallet({
      mnemonic,
    })

    const wallet = await this.wallet.createES256K({
      passphrase: passphrase,
      walletId: walletId,
    })

    return wallet as any
  }

  async addMetadataContracts(
    client: SigningCosmWasmClient,
    codeId: string | number,
    initMsg: any,
  ) {
    const contractCodeHash = await client.restClient.getCodeHashByCodeId(codeId)
    console.log(`Contract hash: ${contractCodeHash}`)
    const contract = await client.instantiate(codeId, initMsg, 'metadata')
    console.log('contract: ', contract)
    const execute = async <T>(msg: T, memo: any, amount: any, fee: any) =>
      client.execute(contract.contractAddress, msg as any, memo, amount, fee)
    const q = async <T>(msg: T, p: any) =>
      client.queryContractSmart(contract.contractAddress, msg as any, p)
    const newLocal = {
      contractAddress: contract.contractAddress,
      files: {
        add: async (msg: any, memo: any, amount: any, fee: any) => {
          const err = await handleMsg(msg)
          return execute(msg, memo, amount, fee)
        },
        get: async (msg: any, p: any) => {
          const err = await queryMsg(msg)
          return q(msg, p)
        },
      },
      metadata: {
        add: async (msg: any, memo: any, amount: any, fee: any) => {
          const err = await handleMsg(msg)
          return execute(msg, memo, amount, fee)
        },
        get: async (msg: any, p: any) => {
          const err = await queryMsg(msg)
          return q(msg, p)
        },
      },
      defaultAccount: await client.getAccount(),
    }

    this.contracts.metadata = newLocal as Ancon
  }
  getContract(name: string): Ancon {
    return this.contracts[name]
  }
  async createSecretProvider(
    accountName: string,
    passphrase: string,
    mnemonic?: string,
  ) {
    const acct = (await this.wallet.getAccount()) as any
    let walletId = ''
    if (acct.keystores.length === 0) {
      //  TODO: Mnemonic must come from XDV Node Provider because it is using a custom chain
      walletId = await this.wallet.addWallet({
        mnemonic,
      })
    } else {
      walletId = acct.keystores[0].walletId
    }

    const keystore = await acct.keystores.find(
      (k: KeystoreDbModel) => k.walletId === walletId,
    )

    //     const msg = await txClient.msgCreateFile(value)
    //     const result = await txClient.signAndBroadcast([msg], {fee: { amount: fee,
    // gas: "200000" }, memo})

    const REST_URL = 'http://bootstrap.secrettestnet.io:26657'
    const WS_URL = 'WS://bootstrap.secrettestnet.io:26657'
    const tm = await Tendermint34Client.connect(WS_URL)
    const signingPen = await Secp256k1Pen.fromMnemonic(keystore.mnemonic)

    // Get the public key
    const pubkey = encodeSecp256k1Pubkey(signingPen.pubkey)

    // get the wallet address
    const accAddress = pubkeyToAddress(pubkey, 'secret')

    const txEncryptionSeed = EnigmaUtils.GenerateNewSeed()

    const client = new SigningCosmWasmClient(
      REST_URL,
      accAddress,
      (signBytes) => signingPen.sign(signBytes),
      txEncryptionSeed,
      customFees,
    )

    return {
      tmclient: tm,
      client,
    }
  }
}
