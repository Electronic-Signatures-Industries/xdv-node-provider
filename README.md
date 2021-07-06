# xdv-node-provider


## how to use the

1. build stargate project
2. copy generated client stubs from `vue` folder to `genclient.ts` and `genrestclient.ts`
3. copy `types` folder

## run manual tests

1. `ts-node test.ts`


## using xdv node provider (beta)

```typescript

import { XDVNodeProvider } from '.'

export class Test {
  static async uploadFile() {
    const client = new XDVNodeProvider()
    await client.createAccount('walletcore', 'abc123456789')
    const provider = await client.createXDVProvider(
      'walletcore',
      'abc123456789',
    )
    const msg = await provider.msgCreateFile({
      creator: 'xdv1k8pm7722uewy5etnmt9ecywt9sem5dcer5ltue',
      contentType: 'text/plain',
      data: Buffer.from('hello world'),
    })
    const fee = [];
    const result = await provider.signAndBroadcast([msg], {
      fee: { amount: fee, gas: '200000' },
    })

    console.log(result)
  }
}

;(async function bootstrap() {
  await Test.uploadFile()
})()

```

### @molekilla for
#### IDAO / IFESA / Fernando Romero 2021
