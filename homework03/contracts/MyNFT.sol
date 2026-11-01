// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";



contract MyNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard{


    struct Listing {
        address seller;        // 卖家地址
        address nftContract;   // NFT 合约地址
        uint256 tokenId;       // NFT 的 tokenId
        uint256 price;         // 以 wei 表示的售价
        bool active;           // 挂单是否有效
    }

    uint256 private _tokenIdCounter;  // 用于生成唯一 tokenId 的计数器
    uint256 public constant MAX_SUPPLY = 10000;  // NFT 最大供应量
    uint256 public mintPrice = 0.01 ether;  // 单个 NFT 的铸造价格
    
    

    // 铸造 NFT
    event NFTMinted(
        address sender, 
        uint256 newTokenId, 
        string uri
    );

    

    // 重写 tokenURI，以兼容 ERC721URIStorage
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // 重写 supportsInterface，以组合父合约支持的接口
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }






    
    // 初始化 NFT 名称、代号和合约所有者
    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}


    // 铸造 NFT 并设置其元数据 URI
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
