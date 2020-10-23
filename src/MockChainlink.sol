pragma solidity ^0.5.12;

contract MockChainLink {
    function latestAnswer() external pure returns(int) { return 0; }
}
