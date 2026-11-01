import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor() ERC20("Test Token", "TST") {
        _mint(msg.sender, 1_000_000 * 10 ** uint256(decimals()));
    }
}