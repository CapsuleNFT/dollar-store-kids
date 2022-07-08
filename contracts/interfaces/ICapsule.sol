// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface ICapsule is IERC721 {
    function mint(address account, string memory _uri) external;

    function burn(address owner, uint256 tokenId) external;

    // Admin functions
    function lockCollectionCount(uint256 _nftCount) external;

    function setTokenURI(uint256 _tokenId, string memory _newTokenURI) external;

    function transferOwnership(address _newOwner) external;

    function updateTokenURIOwner(address _newTokenURIOwner) external;

    // Read functions
    function counter() external view returns (uint256);

    function exists(uint256 tokenId) external view returns (bool);

    function isCollectionMinter(address _account) external view returns (bool);

    function maxId() external view returns (uint256);

    function owner() external view returns (address);

    function tokenURI(uint256 tokenId) external view returns (string memory);

    function tokenURIOwner() external view returns (address);
}
