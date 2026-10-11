// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";



contract MyNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard{


    struct Listing {
        address seller;        // 卖家地址
        address nftContract;   // NFT合约地址
        uint256 tokenId;       // Token ID
        uint256 price;         // 售价（wei）
        bool active;           // 是否激活
    }

    uint256 private _tokenIdCounter;  // 用于生成唯一的tokenId
    uint256 public constant MAX_SUPPLY = 10000;  // 最大供应量
    uint256 public mintPrice = 0.01 ether;  // 铸造价格
    
    

     // 铸造NFT
    event NFTMinted(
        address sender, 
        uint256 newTokenId, 
        string uri
    );

    

    // 重写tokenURI
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // 重写supportsInterface
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }






    
    // 构造函数
    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}


    // mint函数
    function mint(string memory uri) public payable returns (uint256) {
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");
        
        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;
        
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, uri);
        
        emit NFTMinted(msg.sender, newTokenId, uri);
        
        return newTokenId;
    }




   






    
}