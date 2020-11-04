pragma solidity ^0.5.12;

contract MockChainLink {
    int price;

    constructor(int _price) public {
        price = _price;
    }
    
    function setPrice(int _price) external {
        price = _price;
    }
    
    function latestAnswer() external view returns(int) {
        return price;
    }
}
