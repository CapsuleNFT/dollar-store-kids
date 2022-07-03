// SPDX-License-Identifier: GPLv3

pragma solidity 0.8.9;

// interfaces
import "interfaces/ICapsule.sol";
import "interfaces/ICapsuleMinter.sol";
import "openzeppelin/contracts/token/ERC20/IERC20.sol";

// other
import "openzeppelin/contracts/access/Ownable.sol";

contract TheDollarStore is Ownable {
  // variables
  // Your Capsule Collection address
  address public capsuleCollection;
  // BaseURI for setting tokenURI
  string private baseURI;
  // USDC Contract
  address public USDCTokenContract = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  // Dollar Store mint start time
  bool public started = false;

  // constants
  // Capsule Minter Address
  address public constant CAPSULE_MINTER = "0xb8Cf4A28DA322598FDB78a1406a61B72d6F6b396";
  // Allowed Dollar Store mints per address
  uint256 public constant MINT_PER_ADDRESS = 1;
  // Max amount of Dollars to release
  uint256 public constant MAX_AMOUNT = 9999;

  // mapping of addresses who have minted and received their Dollar
  mapping(address => uint) public addressClaimed;

  constructor(address _capsuleCollection) {
    capsuleCollection = _capsuleCollection;
    lockCollection(MAX_AMOUNT);
  }

  function mint() external payable {
    require(started, "The Dollar Store is not open yet");
    require(addressClaimed[_msgSender()] < MINT_PER_ADDRESS, "You have already acquired your Dollar");

    uint256 collectionCounter = ICapsule(capsuleCollection).counter();

    // mint
    addressClaimed[_msgSender()] += 1;

    ICapsuleMinter(CAPSULE_MINTER).mintSingleERC20Capsule(
      capsuleCollection,
      USDCTokenContract,
      1000000000000000000, // 1 USDC
      string(abi.encodePacked(baseURI, Strings.toString(collectionCounter))), // token URI
      _msgSender()
    ); // payable
  }

  function burn(uint256 _id) external {
    ICapsuleMinter(CAPSULE_MINTER).burnSingleERC20Capsule(capsuleCollection, _id);
    IERC20(USDCTokenContract).transfer(_msgSender(), 1000000000000000000); // 1 USDC
  }

  function setBaseURI(string memory _baseURI) external onlyOwner {
      baseURI = _baseURI;
  }

  function enableMint(bool mintStarted) external onlyOwner {
      started = mintStarted;
  }

  // admin methods
  function lockCollection(uint256 _amount) internal {
    ICapsule(_capsuleCollection).lockCollectionCount(_amount);
  }

  function transferOwnership(address memory _account) onlyOwner {
    ICapsule(_capsuleCollection).transferOwnership(_account);
  }

  function transferMetamaster(address memory _account) onlyOwner {
    ICapsule(_capsuleCollection).updateTokenURIOwner(_account);
  }
}
