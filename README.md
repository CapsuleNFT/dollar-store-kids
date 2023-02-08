# Dollar Store Kids

This page highlights an example implementation of the CapsuleNFT protocol with the popular NFT collection, Dollar Store Kids.

At any time, the final version of the code can be seen on Github here. This code has also been audited by Quantstamp, with results viewable here.

## Summary of Dollar Store Kids

Dollar Store Kids is the first NFT Collection of its kind in which every DSK can be redeemed for $1 USDC. Redeeming the DSK permanently burns the NFT, thereby reducing the total Dollar Store Kids in the collection by one.

### Code Overview

Before hopping into the code, let's explore how this contract worked:
- Upon deployment of the Dollar Store Kids contract, the constructor would deploy its own Capsule NFT Collection (it now owns that collection) with specific parameters (further information here).
- The collection `baseURI` (collection metadata) is set through the constructor, but can also be changed at any time through the `updateBaseURI()` method.
- The moment the `toggleMint()` method is called, anyone can mint their own DSK from the contract by calling `mint()`
- At any time, any user may redeem his DSK by calling the `burn()` function

### Other Considerations

The Dollar Store Kids were launched under the following conditions:
- The Dollar Store Kids maximum total supply (`MAX_DSK`) was set to X.
- The Dollar Store Kids contract was funded with USDC. This was to X, to correspond to the maximum total supply.
- In order to mint a Dollar Store Kid, the user would pay 0.001 ETH. This is the fee to mint an NFT using the Capsule NFT protocol.
- Mint is limited to one Dollar Store Kid per account.

## Dollar Store Kids Code

This section will go over some implementation requirements and decisions made in the Dollar Store Kids contract.

### Implementing the Capsule Protocol

Adding the Capsule protocol to the contract is as simple as below:

```
ICapsuleFactory public constant CAPSULE_FACTORY = ICapsuleFactory(0x4Ced59c19F1f3a9EeBD670f746B737ACf504d1eB);
ICapsuleMinter public constant CAPSULE_MINTER = ICapsuleMinter(0xb8Cf4A28DA322598FDB78a1406a61B72d6F6b396);
ICapsule public immutable capsuleCollection;
```

This allows to you interact with all of the methods of the Capsule protocol, alongside any ERC-721 NFT based methods (within `ICapsule`).

### Core Functions

Since this is an NFT Collection owner, the most important methods are for users to mint and burn their Dollar Store Kid.

- `function mint()`

As mentioned above, the Dollar Store Kids collection was limited to one mint per account. Most of the logic in the mint method relates to such condition.

The remaining logic relates to the creation of a Dollar Store Kid Capsule NFT.

```
// Mint the DSK
CAPSULE_MINTER.mintSingleERC20Capsule{value: msg.value}(
    address(capsuleCollection),
    USDC,
    ONE_DOLLAR,
    "",
    _caller
);
```

A more thorough explanation of the minting of a Capsule NFT can be found here. Note that this method could have included a different token, such as wETH, BAYC (with `mintSingleERC721Capsule`), or multiple tokens (with `mintMultiERC20Capsule` or `mintMultiERC721Capsule`).

Since we supplied the USDC to the Dollar Store Kids contract, there was no need for the user to transfer any tokens to the contract first. This step should be considered when creating your own collection.

- `function burn()`

Quite simply, this method accepts the user's Dollar Store Kid, and burns it for them. There is the possibility of adding more logic to this method.

```
CAPSULE_MINTER.burnSingleERC20Capsule(address(capsuleCollection), id_);
```

We then transfer the USDC back to the user.

### Governor Functions

The Governor functions are admin functions used for varying purposes:

- `function sweep(address _token)`

Used to withdraw any tokens sent to the Dollar Store Kids contract.

- `function toggleMint()`

Used to either start the mint process for the collection, or pause it.

- `function transferCollectionOwnership(address newOwner_)`

Used to transfer the ownership of the underlying Capsule NFT Collection.

- `function updateMetamaster(address metamaster_)`

Used to transfer `metamaster` ownership of the Capsule NFT Collection. For more information on `metamaster` privileges, view here.

- `function updateBaseURI(string memory baseURI_)`

Used to update the `baseURI` of the collection.

- `function updateRoyaltyConfig(address royaltyReceiver_, uint256 royaltyRate_)`

Used to update the royalty config for the base Capsule NFT contract.

## Mainnet addresses
- Dollar Store Kids: 0xE4c3c91De9Eb9b92CedeE9ddB1e4d3388318151c
- Dollar Store Kids V2 : 0x22d8f86350E983de8758eaF66A19558b73F11A00
- Collection: 0xC67F5E3a5B697AE004Edd8F84925189a81c6DC4b

## Summary

At any time, the final version of the code can be seen on Github here. This code has also been audited by Quantstamp, with results viewable here.

This is an example of utilizing the Capsule NFT protocol to create your own composable NFT collection. There are a variety of other usecases creatable with CapsuleNFT.

Happy building!

# Repo

## Setup
```bash
npm install
```

## Test
- In order to run tests, set NODE_URL in either `.env` file or export as env var.
```sh
export NODE_URL=<eth mainnet url>
```
- Run tests
```bash
npm test
```

### Coverage
```bash
npm run coverage
```
