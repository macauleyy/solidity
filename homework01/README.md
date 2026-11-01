# Solidity 基础与算法练习

本目录是独立的 Hardhat 3 子项目，合约源码位于 `contracts/Exercises.sol`，包含以下练习：

- `Voting`：记录候选人票数、投票、查询票数，并由部署者重置所有票数。
- `StringReverser`：反转 ASCII 字符串的字节顺序；不支持按 Unicode 字符反转。
- `RomanNumerals`：整数与规范罗马数字互转，支持 1 到 3999。
- `SortedArrayMerger`：合并两个升序数组。
- `BinarySearch`：在升序数组中查找目标值，未找到时返回 `-1`。

`Voting` 允许同一地址重复投票；重置票数由部署者执行。

## 编译

```sh
npm install
npx hardhat build
```
