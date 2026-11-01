// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @dev 仅用于本地测试的 Chainlink 兼容价格预言机
contract MockV3Aggregator is AggregatorV3Interface {
    uint8 public immutable override decimals;
    int256 private answer;
    uint256 private updatedAt;
    bool private shouldRevert;

    constructor(uint8 decimals_, int256 initialAnswer) {
        decimals = decimals_;
        answer = initialAnswer;
        updatedAt = block.timestamp;
    }

    function setData(int256 answer_, uint256 updatedAt_, bool shouldRevert_) external {
        answer = answer_;
        updatedAt = updatedAt_;
        shouldRevert = shouldRevert_;
    }

    function description() external pure override returns (string memory) {
        return "Mock USD Feed";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80)
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return _roundData();
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        require(!shouldRevert, "Mock feed failure");
        return _roundData();
    }

    function _roundData()
        private
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}
