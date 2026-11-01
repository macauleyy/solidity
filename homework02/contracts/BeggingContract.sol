// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title 捐赠合约（BeggingContract）
/// @notice 接收 ETH 捐赠，并允许所有者提取全部余额
contract BeggingContract {
    address public immutable owner;

    /// @notice 按地址记录累计捐赠金额，单位为 wei
    mapping(address => uint256) private _donations;

    event Donated(address indexed donor, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);

    error OnlyOwner();
    error ZeroDonation();
    error NoFundsToWithdraw();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice 接收 ETH 捐赠，并累计记录同一地址的多次捐赠
    function donate() external payable {
        if (msg.value == 0) revert ZeroDonation();

        _donations[msg.sender] += msg.value;
        emit Donated(msg.sender, msg.value);
    }

    /// @notice 将合约的全部 ETH 余额转给所有者
    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NoFundsToWithdraw();

        payable(owner).transfer(amount);
        emit Withdrawn(owner, amount);
    }

    /// @notice 查询指定地址的累计捐赠金额，单位为 wei
    function getDonation(address donor) external view returns (uint256) {
        return _donations[donor];
    }
}
