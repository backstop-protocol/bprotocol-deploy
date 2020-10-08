pragma solidity ^0.5.12;

import { DSValue } from "ds-value/value.sol";

contract MockPriceFeed is DSValue {
    function read(bytes32 ilk) external view returns(bytes32) {
        ilk; //shh
        return read();
    }
}
