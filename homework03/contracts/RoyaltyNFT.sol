// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/// @dev 供 Auctions 测试使用的轻量级 ERC-2981 NFT
contract RoyaltyNFT is ERC721, ERC2981 {
    constructor(address receiver, uint96 feeNumerator) ERC721("Royalty NFT", "RNFT") {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function mint(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

contract RevertingRoyaltyNFT is ERC721 {
    constructor() ERC721("Reverting Royalty NFT", "RRNFT") {}

    function mint(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        if (interfaceId == type(IERC2981).interfaceId) return true;
        return super.supportsInterface(interfaceId);
    }

    function royaltyInfo(uint256, uint256) external pure returns (address, uint256) {
        revert("Royalty query failed");
    }
}

contract RevertingInterfaceNFT is ERC721 {
    constructor() ERC721("Reverting Interface NFT", "RINFT") {}

    function mint(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
    }

    function supportsInterface(bytes4) public pure override returns (bool) {
        revert("Interface query failed");
    }
}

contract InvalidRoyaltyNFT is ERC721 {
    constructor() ERC721("Invalid Royalty NFT", "IRNFT") {}

    function mint(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        if (interfaceId == type(IERC2981).interfaceId) return true;
        return super.supportsInterface(interfaceId);
    }

    function royaltyInfo(uint256, uint256 salePrice) external pure returns (address, uint256) {
        return (address(0), salePrice + 1);
    }
}
