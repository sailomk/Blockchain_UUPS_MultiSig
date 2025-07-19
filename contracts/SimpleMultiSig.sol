// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol"; // For debugging purposes in Hardhat

contract SimpleMultisig {
    event Deposit(address indexed sender, uint256 amount);
    event Submission(
        uint256 indexed txId,
        address indexed to,
        uint256 value,
        bytes data
    );
    event Confirmation(address indexed owner, uint256 indexed txId);
    event Revocation(address indexed owner, uint256 indexed txId);
    event Execution(uint256 indexed txId);

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public numConfirmationsRequired;

    struct Transaction {
        address to;
        uint256 value;
        bytes data; // The calldata to be executed
        bool executed;
        uint256 numConfirmations;
    }

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations; // txId => owner => confirmed

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }

    modifier txExists(uint256 _txId) {
        require(_txId < transactions.length, "Tx does not exist");
        _;
    }

    modifier notExecuted(uint256 _txId) {
        require(!transactions[_txId].executed, "Tx already executed");
        _;
    }

    modifier notConfirmed(uint256 _txId) {
        require(
            !confirmations[_txId][msg.sender],
            "Tx already confirmed by sender"
        );
        _;
    }

    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "Owners required");
        require(_numConfirmationsRequired > 0, "Confirmations required");
        require(
            _numConfirmationsRequired <= _owners.length,
            "Invalid num confirmations"
        );

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner address");
            require(!isOwner[owner], "Owner not unique"); // Prevent duplicates
            isOwner[owner] = true;
            owners.push(owner);
        }
        numConfirmationsRequired = _numConfirmationsRequired;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function submitTransaction(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) public onlyOwner returns (uint256 txId) {
        txId = transactions.length;
        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data, // Store the calldata
                executed: false,
                numConfirmations: 0
            })
        );
        // --- NEW DEBUGGING LOG ---
        console.log("Multisig: Submitted transaction ID:", txId);
        // console.log("Multisig: Storing calldata:", _data);
        // --- END NEW DEBUGGING LOG ---
        emit Submission(txId, _to, _value, _data);
    }

    function confirmTransaction(
        uint256 _txId
    ) public onlyOwner txExists(_txId) notExecuted(_txId) notConfirmed(_txId) {
        confirmations[_txId][msg.sender] = true;
        transactions[_txId].numConfirmations++;

        emit Confirmation(msg.sender, _txId);

        // Optionally, auto-execute if threshold is met
        if (transactions[_txId].numConfirmations >= numConfirmationsRequired) {
            // executeTransaction(_txId);
            console.log("xxxx");
        }
    }

    function revokeConfirmation(
        uint256 _txId
    ) public onlyOwner txExists(_txId) notExecuted(_txId) {
        require(confirmations[_txId][msg.sender], "Confirmation not found");

        confirmations[_txId][msg.sender] = false;
        transactions[_txId].numConfirmations--;

        emit Revocation(msg.sender, _txId);
    }

    function executeTransaction(
        uint _txId
    )
        public
        onlyOwner // Only an owner can trigger execution
        txExists(_txId)
        notExecuted(_txId)
    {
        require(
            transactions[_txId].numConfirmations >= numConfirmationsRequired,
            "Not enough confirmations"
        );

        Transaction storage transaction = transactions[_txId];

        // --- EXISTING DEBUGGING LOGS ---
        console.log("Multisig: Attempting to execute transaction ID:", _txId);
        console.log("Multisig: Target address:", transaction.to);
        console.log("Multisig: Value (wei):", transaction.value);
        // console.log("Multisig: Calldata:", transaction.data); // This is the line in question
        // --- END EXISTING DEBUGGING LOGS ---

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );

        require(success, "Tx execution failed in multisig"); // This is the line that's currently reverting
        transaction.executed = true;

        emit Execution(_txId);
    }

    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(
        uint256 _txId
    )
        public
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txId];
        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}
