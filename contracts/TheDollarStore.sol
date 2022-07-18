// SPDX-License-Identifier: GPLv3

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./access/Governable.sol";
import "./interfaces/ICapsule.sol";
import "./interfaces/ICapsuleFactory.sol";
import "./interfaces/ICapsuleMinter.sol";

/// @title The Dollar Store
contract TheDollarStore is Governable, IERC721Receiver {
    using SafeERC20 for IERC20;

    string public provenanceHash;
    /// @notice Input token for the Dollar Store
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    ICapsuleFactory public constant CAPSULE_FACTORY = ICapsuleFactory(0x4Ced59c19F1f3a9EeBD670f746B737ACf504d1eB);
    ICapsuleMinter public constant CAPSULE_MINTER = ICapsuleMinter(0xb8Cf4A28DA322598FDB78a1406a61B72d6F6b396);
    /// @notice Allowed Dollar Store mints per address
    uint8 public constant MINT_PER_ADDRESS = 1;
    /// @notice Max amount of Dollars to release
    uint16 public constant MAX_DOLLARS = 9999;

    /// @notice Dollar Store storage collection
    ICapsule public immutable capsuleCollection;
    /// @notice Flag indicating whether the Dollar Store mint is enabled.
    bool public isMintEnabled;
    /// @notice Mapping of addresses who have minted and received their Dollar.
    mapping(address => bool) public alreadyMinted;

    uint256 private constant ONE_DOLLAR = 1e6; // 1 USDC

    event DollarMinted(address indexed user, uint256 indexed id);
    event DollarBurnt(address indexed user, uint256 indexed id);

    constructor(string memory provenanceHash_, string memory baseURI_) payable {
        provenanceHash = provenanceHash_;
        capsuleCollection = ICapsule(
            CAPSULE_FACTORY.createCapsuleCollection{value: msg.value}("The Dollar Store", "DOLLAR", address(this), true)
        );
        updateBaseURI(baseURI_);
        capsuleCollection.lockCollectionCount(MAX_DOLLARS);
        IERC20(USDC).safeApprove(address(CAPSULE_MINTER), MAX_DOLLARS * ONE_DOLLAR);
    }

    /// @notice Mint a Dollar to caller address
    function mint() external payable {
        require(isMintEnabled, "mint-is-not-enabled");
        address _caller = _msgSender();
        require(!alreadyMinted[_caller], "already-minted-dollar");

        uint256 _counter = capsuleCollection.counter();
        require(_counter < MAX_DOLLARS, "max-supply-reached");
        // Each address is allowed to mint a max of 1 Dollar - update state
        alreadyMinted[_caller] = true;

        // Mint the Dollar
        CAPSULE_MINTER.mintSingleERC20Capsule{value: msg.value}(
            address(capsuleCollection),
            USDC,
            ONE_DOLLAR,
            "",
            _caller
        );
        emit DollarMinted(_caller, _counter);
    }

    /**
     * @notice Burn a Dollar and get 1 USDC back
     * @param id_ Dollar id to burn
     */
    function burn(uint256 id_) external {
        address _caller = _msgSender();
        // Transfer Dollar here
        capsuleCollection.safeTransferFrom(_caller, address(this), id_);
        // Burn Dollar
        CAPSULE_MINTER.burnSingleERC20Capsule(address(capsuleCollection), id_);
        // Transfer user Dollar contents (1 USDC)
        IERC20(USDC).safeTransfer(_caller, ONE_DOLLAR);
        emit DollarBurnt(_caller, id_);
    }

    /// @dev This function enables this contract to receive ERC721 tokens
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /******************************************************************************
     *                            Governor functions                              *
     *****************************************************************************/

    /// @notice onlyGovernor:: Sweep given token to governor address
    function sweep(address _token) external onlyGovernor {
        uint256 _amount = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(governor, _amount);
    }

    /// @notice onlyGovernor:: Toggle minting status of the Dollar Store
    function toggleMint() external onlyGovernor {
        isMintEnabled = !isMintEnabled;
    }

    /**
     * @notice onlyGovernor:: Transfer ownership of the Dollar Store Capsule collection
     * @param newOwner_ Address of new owner
     */
    function transferCollectionOwnership(address newOwner_) external onlyGovernor {
        capsuleCollection.transferOwnership(newOwner_);
    }

    /**
     * @notice onlyGovernor:: Transfer metamaster of the Dollar Store Capsule collection
     * @param metamaster_ Address of new metamaster
     */
    function updateMetamaster(address metamaster_) external onlyGovernor {
        capsuleCollection.updateTokenURIOwner(metamaster_);
    }

    /**
     * @notice onlyGovernor:: Set the collection baseURI
     * @param baseURI_ New baseURI string
     */
    function updateBaseURI(string memory baseURI_) public onlyGovernor {
        capsuleCollection.setBaseURI(baseURI_);
    }

    /**
     * @notice onlyGovernor:: Update royalty receiver and rate in DollarStore collection
     * @param royaltyReceiver_ Address of royalty receiver
     * @param royaltyRate_ Royalty rate in Basis Points. ie. 100 = 1%, 10_000 = 100%
     */
    function updateRoyaltyConfig(address royaltyReceiver_, uint256 royaltyRate_) external onlyGovernor {
        capsuleCollection.updateRoyaltyConfig(royaltyReceiver_, royaltyRate_);
    }
}
