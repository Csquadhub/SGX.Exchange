// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../tokens/MintableBaseToken.sol";

contract SGX is MintableBaseToken {
    constructor() public MintableBaseToken("SGX", "SGX", 0) {
    }

    function id() external pure returns (string memory _name) {
        return "SGX";
    }
}
