pragma solidity ^0.5.12;

contract MockDaiToUsdPriceFeed {
    uint price = 1e18;
    function setPrice(uint newPrice) public {
        price = newPrice;
    }

    function getMarketPrice(uint marketId) public view returns (uint) {
        require(marketId == 3, "invalid-marketId");
        return price;
    }
}
