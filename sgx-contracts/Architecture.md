# Architecture

The main components of the platform are Vault, Routers, Price Feeds, SGX, SGXLP.

## Vault
Vault stores user deposits and handles the main trading functions.
Deposits: Funds are deposited into the Vault through the minting of SGXLP tokens. e.g. if the price of SGXLP is $15, a user can mint 1 SGXLP by depositing 15 USDC tokens.
Withdrawals: Funds can be withdrawn from the vault through the burning of SGXLP tokens. e.g. if the price of SGXLP is $15, a user can burn 1 SGXLP to redeem 15 USDC tokens.
Swaps: The vault allows swapping of the tokens held in the vault. e.g. if the price of ETH is $2000 a user can swap 1 ETH for 2000 USDC through the swap function of the vault.
Longing: Users can open a long position using the vault. e.g. to open a long, a user can deposit 1 ETH into the vault and open a position of $10,000, if the price of ETH at the time of opening the position is $2000, then this would be a 5x long position. If the price of ETH increases by 10%, the user would make a profit of $10,000 * 10% = $1000. A snapshot of the collateral is taken when the position is opened, so in this example, the collateral would be recorded as $2000 and will not change even if the price of ETH changes. To ensure the vault has sufficient funds to pay out any profits, an amount of ETH equivalent to the position’s size is marked as reserved, for this position, 5 ETH in the vault would be reserved.
Shorting: Users can open a short position using the vault. e.g. to open a short, a user can deposit 2000 USDC into the vault and open a position of $10,000. Stablecoins are required as collateral for shorts and similar to longs, an amount of stablecoins equivalent to the size of the position would be reserved to pay out any profits.
Liquidations: A position can be liquidated by keepers if the losses of the position reduces the collateral to the point where position size / remaining collateral is more than the max allowed leverage.

## Router
The Router contracts provide convenience functions on top of the vault. e.g. the vault requires tokens to be sent to it then the swap function called to execute the swap, the router handles transferring the tokens to the vault as well as wrapping / unwrapping of native tokens if required.

The PositionRouter contract handles a two part transaction process for increasing or decreasing long / short positions, this process helps to reduce front-running issues:
* A user sends the request to increase / decrease a position to the PositionRouter
* A keeper requests the index price from an aggregate of exchanges
* The keeper then executes the position at the current index price
* If the position cannot be executed within the allowed slippage the request is cancelled and the funds are sent back to the user

A user can execute the position on their own if three minutes have passed between the request transaction and the execution transaction. The function of the position keepers is to provide convenience and the protocol can continue to operate even without these keepers.


## PriceFeed
The PriceFeed contract accepts submissions from the price feed keeper. This keeper calculates prices using the median price of Binance, FTX and Bitfinex. There are two types of keepers:
* Price feed keeper: submits prices routinely for swaps
* Position keeper: submits prices when executing a position

The vault uses the price from the keeper if it is within a configured percentage of the corresponding Chainlink price. If the price exceeds this threshold then a spread would be created between the bounded price and the Chainlink price, this threshold is based on the historical max deviation of the Chainlink price from the median price of reference exchanges. For example, if the max deviation is 2.5% and the price of the token on Chainlink is $100, if the keeper price is $103, then the pricing on the vault would be $100 to $103. When opening a long position, the higher price is used and when closing the lower price is used, for short positions, the lower price is used when opening and the higher price is used for closing.

Prices from the keeper also have an expiry of five minutes, if the last price has been submitted more than five minutes ago, the Chainlink price will be used instead.

For liquidations, these can only occur if the Chainlink price reaches the liquidation price for a position.

Aside from the keeper nodes, watcher nodes are also ran to verify that the prices submitted by the keepers have not been tampered with. Watcher nodes continually compute the median price and compare this with the prices submitted by keepers, if the prices submitted by a keeper does not match the computed median price, then the watcher sends a transaction to enforce a spread between the keeper price and the Chainlink price. For example, if the keeper is operating normally and the Chainlink price is $100 while the keeper price is $101, there would be no spread and $101 would be used for pricing, if the keeper is not operating normally, and the watcher sends a transaction to enforce a spread, then the pricing used would be $100 to $101.

## Tokens
SGX is the governance token of the platform, it is a regular ERC20 token that can be staked for rewards. 
SGXLP is the liquidity provider token of the platform, it can be minted using any of the tokens within the liquidity pool such as ETH, BTC and USDC.

The token’s price is determined by the worth of all tokens within the pool and factoring in the profits and losses of all currently opened positions.


