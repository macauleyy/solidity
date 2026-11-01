# BeggingContract 捐赠合约练习

这是一个独立的 Hardhat 3 子项目，用于练习接收 ETH 捐赠、记录捐赠金额和提取合约余额。

- `contracts/BeggingContract.sol`：捐赠合约源码。
- `test/BeggingContract.ts`：4 条本地集成测试。

## 安装并在本地验证

```sh
npm install
npm run build
npm test
```

合约会按地址累计记录捐赠金额，单位为 wei。部署合约的账户自动成为所有者，且可通过 `transfer` 提取合约的全部 ETH 余额。

## 使用 Remix 部署到 Sepolia

1. 打开 Remix，创建 `BeggingContract.sol` 文件，或导入本目录中的合约源码。
2. 使用 Solidity `0.8.34` 或兼容的 `0.8.x` 编译器编译。
3. 在 **Deploy & Run Transactions** 中选择 **Injected Provider - MetaMask**，并在 MetaMask 中切换到 Sepolia。
4. 部署 `BeggingContract`。部署账户会成为所有者；在 MetaMask 中确认交易，并保存合约地址和交易哈希。
5. 捐赠时，在 **VALUE** 输入 ETH 数量，单位选择 **ether**，然后调用 `donate`。
6. 调用 `getDonation` 并传入捐赠者地址，查询该地址的累计捐赠金额。
7. 使用所有者账户连接 MetaMask 并调用 `withdraw`，提取合约全部余额。其他账户调用时会收到 `OnlyOwner` 错误。
8. 可在 Sepolia Etherscan 验证源码，并截取部署、捐赠/查询和所有者提款的操作结果作为提交材料。

Goerli 测试网已停止使用，请选择 Sepolia。链上部署需要通过授权钱包连接 Remix，并在 MetaMask 中确认交易。请勿在聊天中分享助记词或私钥。
