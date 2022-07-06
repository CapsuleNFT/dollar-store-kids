// SPDX-License-Identifier: GPLv3

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./access/Governable.sol";
import "./interfaces/ICapsule.sol";
import "./interfaces/ICapsuleFactory.sol";
import "./interfaces/ICapsuleMinter.sol";

/// @title The Dollar Store
contract TheDollarStore is Governable {
    using SafeERC20 for IERC20;

    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    ICapsuleFactory public constant CAPSULE_FACTORY = ICapsuleFactory(0x4Ced59c19F1f3a9EeBD670f746B737ACf504d1eB);
    ICapsuleMinter public constant CAPSULE_MINTER = ICapsuleMinter(0xb8Cf4A28DA322598FDB78a1406a61B72d6F6b396);
    /// @notice Allowed Dollar Store mints per address
    uint8 public constant MINT_PER_ADDRESS = 1;
    /// @notice Max amount of Dollars to release
    uint16 public constant MAX_DOLLARS = 9999;

    /// @notice Dollar storage collection
    address public capsuleCollection;
    /// @notice Flag indicating whether Dollar Store mint is enabled.
    bool public isMintEnabled = false;
    /// @notice Mapping of addresses who have minted and received their Dollar.
    mapping(address => bool) public alreadyMinted;

    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    uint256 private constant ONE_DOLLAR = 1e6;
    string private baseURI;

    constructor(string memory baseURI_) payable {
        baseURI = baseURI_;
        capsuleCollection = CAPSULE_FACTORY.createCapsuleCollection{value: msg.value}(
            "The Dollar Store",
            "TDS",
            address(this),
            true
        );
        ICapsule(capsuleCollection).lockCollectionCount(MAX_DOLLARS);
        IERC20(USDC).safeApprove(address(CAPSULE_MINTER), MAX_DOLLARS * ONE_DOLLAR);
    }

    /// @notice Mint Dollar to caller address
    function mint() external payable {
        require(isMintEnabled, "mint-is-not-enabled");
        require(!alreadyMinted[_msgSender()], "already-minted-dollar");

        uint256 _counter = ICapsule(capsuleCollection).counter();
        require(_counter < MAX_DOLLARS, "max-supply-reached");
        alreadyMinted[_msgSender()] = true;

        CAPSULE_MINTER.mintSingleERC20Capsule{value: msg.value}(
            capsuleCollection,
            USDC,
            ONE_DOLLAR,
            string(abi.encodePacked(baseURI, Strings.toString(_counter))), // token URI
            _msgSender()
        );
    }

    /**
     * @notice Burn Dollar and get 1 USDC back
     * @param id_ Dollar id to burn
     */
    function burn(uint256 id_) external {
        CAPSULE_MINTER.burnSingleERC20Capsule(capsuleCollection, id_);
        IERC20(USDC).transfer(_msgSender(), ONE_DOLLAR); // 1 USDC
    }

    /******************************************************************************
     *                            Governor functions                              *
     *****************************************************************************/

    /// @notice onlyGovernor:: Sweep given token to governor address
    function sweep(address _token) external onlyGovernor {
        if (_token == ETH) {
            Address.sendValue(payable(governor), address(this).balance);
        } else {
            uint256 _amount = IERC20(_token).balanceOf(address(this));
            IERC20(_token).safeTransfer(governor, _amount);
        }
    }

    /// @notice onlyGovernor:: Toggle minting status of the Dollar Store
    function toggleMint() external onlyGovernor {
        isMintEnabled = !isMintEnabled;
    }

    /**
     * @notice onlyGovernor:: Transfer ownership of the Dollar Store Capsule collection
     * @param newOwner_ Address of new owner
     */
    function transferOwnership(address newOwner_) external onlyGovernor {
        ICapsule(capsuleCollection).transferOwnership(newOwner_);
    }

    /**
     * @notice onlyGovernor:: Transfer meta master of the Dollar Store Capsule collection
     * @param metaMaster_ Address of new meta master
     */
    function updateMetaMaster(address metaMaster_) external onlyGovernor {
        ICapsule(capsuleCollection).updateTokenURIOwner(metaMaster_);
    }
}
