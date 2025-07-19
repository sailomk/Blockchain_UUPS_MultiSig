// SPDX-License-Identifier: MIT
// MyContractV1.sol
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract MyContractV1 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public value;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    } // Constructor นี้จะถูกเรียกใช้เมื่อ Deploy Proxy Contract เท่านั้น ไม่ใช่เมื่อ Initialize

    function initialize(address owner) public initializer {
        __Ownable_init(owner);
        __UUPSUpgradeable_init();
        value = 0;
    }
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /*     function _authorizeUpgrade(
        address newImplementation
    ) internal pure override {
        require(
            newImplementation != address(0),
            "Invalid implementation address"
        );
    } */

    function setValue(uint256 _newValue) public onlyOwner {
        value = _newValue;
    }

    function getValue() public view returns (uint256) {
        return value;
    }

    function version() external pure returns (uint256) {
        return 1;
    }
}
