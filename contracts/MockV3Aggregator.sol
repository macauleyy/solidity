// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @dev Local-only Chainlink-compatible price feed for tests.
contract MockV3Aggregator is AggregatorV3Interface {
    uint8 public immutable override decimals;
    int256 private answer;

    constructor(uint8 decimals_, int256 initialAnswer) {
        decimals = decimals_;
        answer = initialAnswer;
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
        return _roundData();
    }

    function _roundData()
        private
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (1, answer, block.timestamp, block.timestamp, 1);
    }
}
