// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice 基础候选人投票合约，仅部署者可以重置得票数
contract Voting {
    address public immutable owner;

    mapping(string => uint256) private candidateVotes;
    mapping(string => uint256) private candidateEpoch;
    uint256 public currentEpoch = 1;

    event VoteCast(address indexed voter, string candidate);
    event VotesReset();

    constructor() {
        owner = msg.sender;
    }

    function vote(string calldata candidate) external {
        require(bytes(candidate).length != 0, "Candidate is empty");

        if (candidateEpoch[candidate] != currentEpoch) {
            candidateEpoch[candidate] = currentEpoch;
            candidateVotes[candidate] = 0;
        }

        candidateVotes[candidate] += 1;
        emit VoteCast(msg.sender, candidate);
    }

    function getVotes(string calldata candidate) external view returns (uint256) {
        if (candidateEpoch[candidate] != currentEpoch) return 0;
        return candidateVotes[candidate];
    }

    function resetVotes() external {
        require(msg.sender == owner, "Only owner");
        require(currentEpoch < type(uint256).max, "Epoch overflow");
        currentEpoch += 1;
        emit VotesReset();
    }
}

/// @notice 反转 ASCII 字符串中的字节顺序
/// @dev 本函数反转的是字节而非 Unicode 字符，因此仅适用于 ASCII 输入
contract StringReverser {
    function reverse(string calldata input) external pure returns (string memory) {
        bytes memory source = bytes(input);
        bytes memory result = new bytes(source.length);
        for (uint256 i = 0; i < source.length; i++) {
            result[i] = source[source.length - 1 - i];
        }
        return string(result);
    }
}

/// @notice 在整数与规范罗马数字之间进行转换，支持范围为 1 到 3999
contract RomanNumerals {
    function intToRoman(uint256 number) external pure returns (string memory) {
        require(number > 0 && number <= 3999, "Number out of range");

        uint256[13] memory values = [
            uint256(1000), 900, 500, 400, 100, 90, 50,
            40, 10, 9, 5, 4, 1
        ];
        bytes[13] memory symbols;
        symbols[0] = bytes("M");
        symbols[1] = bytes("CM");
        symbols[2] = bytes("D");
        symbols[3] = bytes("CD");
        symbols[4] = bytes("C");
        symbols[5] = bytes("XC");
        symbols[6] = bytes("L");
        symbols[7] = bytes("XL");
        symbols[8] = bytes("X");
        symbols[9] = bytes("IX");
        symbols[10] = bytes("V");
        symbols[11] = bytes("IV");
        symbols[12] = bytes("I");

        bytes memory output = new bytes(15);
        uint256 length;
        for (uint256 i = 0; i < values.length; i++) {
            while (number >= values[i]) {
                for (uint256 j = 0; j < symbols[i].length; j++) {
                    output[length++] = symbols[i][j];
                }
                number -= values[i];
            }
        }

        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) result[i] = output[i];
        return string(result);
    }

    function romanToInt(string calldata roman) external pure returns (uint256) {
        bytes calldata symbols = bytes(roman);
        require(symbols.length != 0, "Roman numeral is empty");

        uint256 total;
        uint256 i;
        while (i < symbols.length) {
            uint256 current = _value(symbols[i]);
            if (i + 1 < symbols.length && current < _value(symbols[i + 1])) {
                total += _value(symbols[i + 1]) - current;
                i += 2;
            } else {
                total += current;
                i++;
            }
        }

        require(total > 0 && total <= 3999, "Number out of range");
        require(
            keccak256(bytes(_toRoman(total))) == keccak256(symbols),
            "Non-canonical Roman numeral"
        );
        return total;
    }

    function _value(bytes1 symbol) private pure returns (uint256) {
        if (symbol == "I") return 1;
        if (symbol == "V") return 5;
        if (symbol == "X") return 10;
        if (symbol == "L") return 50;
        if (symbol == "C") return 100;
        if (symbol == "D") return 500;
        if (symbol == "M") return 1000;
        revert("Invalid Roman symbol");
    }

    function _toRoman(uint256 number) private pure returns (string memory) {
        uint256[13] memory values = [
            uint256(1000), 900, 500, 400, 100, 90, 50,
            40, 10, 9, 5, 4, 1
        ];
        bytes[13] memory symbols;
        symbols[0] = bytes("M");
        symbols[1] = bytes("CM");
        symbols[2] = bytes("D");
        symbols[3] = bytes("CD");
        symbols[4] = bytes("C");
        symbols[5] = bytes("XC");
        symbols[6] = bytes("L");
        symbols[7] = bytes("XL");
        symbols[8] = bytes("X");
        symbols[9] = bytes("IX");
        symbols[10] = bytes("V");
        symbols[11] = bytes("IV");
        symbols[12] = bytes("I");

        bytes memory output = new bytes(15);
        uint256 length;
        for (uint256 i = 0; i < values.length; i++) {
            while (number >= values[i]) {
                for (uint256 j = 0; j < symbols[i].length; j++) {
                    output[length++] = symbols[i][j];
                }
                number -= values[i];
            }
        }

        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) result[i] = output[i];
        return string(result);
    }
}

/// @notice 将两个升序数组合并为一个升序数组
contract SortedArrayMerger {
    function mergeSorted(uint256[] calldata first, uint256[] calldata second)
        external
        pure
        returns (uint256[] memory merged)
    {
        merged = new uint256[](first.length + second.length);
        uint256 i;
        uint256 j;
        uint256 k;

        while (i < first.length && j < second.length) {
            if (first[i] <= second[j]) merged[k++] = first[i++];
            else merged[k++] = second[j++];
        }
        while (i < first.length) merged[k++] = first[i++];
        while (j < second.length) merged[k++] = second[j++];
    }
}

/// @notice 在升序数组中执行二分查找；未找到目标值时返回 -1
contract BinarySearch {
    function search(uint256[] calldata sorted, uint256 target) external pure returns (int256) {
        uint256 low;
        uint256 high = sorted.length;

        while (low < high) {
            uint256 middle = low + (high - low) / 2;
            if (sorted[middle] < target) low = middle + 1;
            else high = middle;
        }

        if (low < sorted.length && sorted[low] == target) return int256(low);
        return -1;
    }
}
