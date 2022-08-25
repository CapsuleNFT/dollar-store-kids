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

/// @title Dollar Store Kids
contract DollarStoreKids is Governable, IERC721Receiver {
    using SafeERC20 for IERC20;

    string public provenanceHash;
    /// @notice Input token for the Dollar Store Kids
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    ICapsuleFactory public constant CAPSULE_FACTORY = ICapsuleFactory(0x4Ced59c19F1f3a9EeBD670f746B737ACf504d1eB);
    ICapsuleMinter public constant CAPSULE_MINTER = ICapsuleMinter(0xb8Cf4A28DA322598FDB78a1406a61B72d6F6b396);
    /// @notice Allowed Dollar Store Kids mints per address
    uint8 public constant MINT_PER_ADDRESS = 1;
    /// @notice Max amount of Dollar Store Kids to release
    uint16 public constant MAX_DSK = 9999;

    /// @notice Dollar Store Kids collection
    ICapsule public immutable capsuleCollection;
    /// @notice Flag indicating whether the Dollar Store Kids mint is enabled.
    bool public isMintEnabled;
    /// @notice Mapping of addresses who have minted.
    mapping(address => bool) public alreadyMinted;

    uint256 private constant ONE_DOLLAR = 1e6; // 1 USDC

    event DollarStoreKidsMinted(address indexed user, uint256 indexed id);
    event DollarStoreKidsBurnt(address indexed user, uint256 indexed id);
    event MintToggled(bool mintStatus);

    constructor(string memory provenanceHash_, string memory baseURI_) payable {
        provenanceHash = provenanceHash_;
        capsuleCollection = ICapsule(
            CAPSULE_FACTORY.createCapsuleCollection{value: msg.value}("Dollar $tore Kids", "D$K", address(this), true)
        );
        updateBaseURI(baseURI_);
        capsuleCollection.lockCollectionCount(MAX_DSK);
        // Using approve as USDC is ERC20 compliant token
        IERC20(USDC).approve(address(CAPSULE_MINTER), MAX_DSK * ONE_DOLLAR);
    }

    /// @notice Mint a DSK to caller address
    function mint() external payable {
        require(isMintEnabled, "mint-is-not-enabled");
        address _caller = _msgSender();
        require(!alreadyMinted[_caller], "already-minted-dsk");

        uint256 _counter = capsuleCollection.counter();
        require(_counter < MAX_DSK, "max-supply-reached");
        // Each address is allowed to mint a max of 1 DSK - update state
        alreadyMinted[_caller] = true;

        // DSK collection will be using baseURL and do not need URI for individual NFTs.
        // Hence passing empty token URI to mint function below.
        CAPSULE_MINTER.mintSingleERC20Capsule{value: msg.value}(
            address(capsuleCollection),
            USDC,
            ONE_DOLLAR,
            "",
            _caller
        );
        emit DollarStoreKidsMinted(_caller, _counter);
    }

    /**
     * @notice Burn a DSK and get 1 USDC back
     * @param id_ DSK id to burn
     */
    function burn(uint256 id_) external {
        address _caller = _msgSender();
        // Transfer DSK here
        capsuleCollection.safeTransferFrom(_caller, address(this), id_);
        // Burn DSK
        CAPSULE_MINTER.burnSingleERC20Capsule(address(capsuleCollection), id_);
        // Transfer user Dollar contents (1 USDC)
        IERC20(USDC).safeTransfer(_caller, ONE_DOLLAR);
        emit DollarStoreKidsBurnt(_caller, id_);
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

    /// @notice onlyGovernor:: Toggle minting status of the Dollar Store Kids
    function toggleMint() external onlyGovernor {
        isMintEnabled = !isMintEnabled;
        emit MintToggled(isMintEnabled);
    }

    /**
     * @notice onlyGovernor:: Transfer ownership of the Dollar Store Kids Capsule collection
     * @param newOwner_ Address of new owner
     */
    function transferCollectionOwnership(address newOwner_) external onlyGovernor {
        capsuleCollection.transferOwnership(newOwner_);
    }

    /**
     * @notice onlyGovernor:: Transfer metamaster of the Dollar Store Kids Capsule collection
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
     * @notice onlyGovernor:: Update royalty receiver and rate in Dollar Store Kids collection
     * @param royaltyReceiver_ Address of royalty receiver
     * @param royaltyRate_ Royalty rate in Basis Points. ie. 100 = 1%, 10_000 = 100%
     */
    function updateRoyaltyConfig(address royaltyReceiver_, uint256 royaltyRate_) external onlyGovernor {
        capsuleCollection.updateRoyaltyConfig(royaltyReceiver_, royaltyRate_);
    }
}
