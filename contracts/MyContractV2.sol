// SPDX-License-Identifier: MIT
// MyContractV2.sol
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "hardhat/console.sol";

contract MyContractV2 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public value;
    string public message; // เพิ่ม State Variable ใหม่,

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // initialize ไม่จำเป็นต้องถูกเรียกอีกในการอัปเกรด แต่ต้องมีอยู่ใน V2
    function initialize(address owner) public initializer {
        __Ownable_init(owner);
        __UUPSUpgradeable_init();
        value = 0;
        message = "Hello from V2";
    }
    // Initialize V2 specific state - can be called after upgrade
    function initializeV2() public onlyOwner {
        // Only initialize if message is empty (hasn't been set yet)
        if (bytes(message).length == 0) {
            message = "Hello from V2";
        }
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {
        console.log(
            "MyContractV2: _authorizeUpgrade called. msg.sender (proxy address):",
            msg.sender
        );
        console.log("MyContractV2: Current owner (multisig address):", owner()); // This calls OwnableUpgradeable's owner()
        require(
            newImplementation != address(0),
            "Invalid new implementation address"
        );
    }
    // function _authorizeUpgrade(
    //     address newImplementation
    // ) internal pure override {
    //     require(
    //         newImplementation != address(0),
    //         "Invalid implementation address"
    //     );
    // }

    function setValue(uint256 _newValue) public onlyOwner {
        value = _newValue;
    }

    function getValue() public view returns (uint256) {
        return value;
    }

    function version() external pure returns (uint256) {
        return 2;
    }

    function setMessage(string memory _newMessage) public onlyOwner {
        // เพิ่มฟังก์ชันใหม่
        message = _newMessage;
    }

    function getMessage() public view returns (string memory) {
        // เพิ่มฟังก์ชันใหม่
        return message;
    }
}
