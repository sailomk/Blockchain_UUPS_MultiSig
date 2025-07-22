// scripts/changeOwner/4.RemoveOwners.js
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    // --- Configuration ---
    // IMPORTANT: Replace these with the actual addresses you want to use
    const CURRENT_OWNER_PRIVATE_KEY = process.env.CURRENT_OWNER_PRIVATE_KEY; // Private key of current owner
    const OWNER_TO_REMOVE_ADDRESS = process.env.OWNER_TO_REMOVE_ADDRESS; // Address of owner to remove

    // Alternative: You can also hardcode addresses for testing (NOT recommended for production)
    // const CURRENT_OWNER_ADDRESS = "0x..."; // Current owner address
    // const OWNER_TO_REMOVE_ADDRESS = "0x..."; // Owner to remove address

    if (!CURRENT_OWNER_PRIVATE_KEY) {
        console.error("Please set CURRENT_OWNER_PRIVATE_KEY environment variable");
        console.log("Usage: CURRENT_OWNER_PRIVATE_KEY=0x... OWNER_TO_REMOVE_ADDRESS=0x... npx hardhat run scripts/changeOwner/4.RemoveOwners.js --network <network>");
        return;
    }

    if (!OWNER_TO_REMOVE_ADDRESS) {
        console.error("Please set OWNER_TO_REMOVE_ADDRESS environment variable");
        console.log("Usage: CURRENT_OWNER_PRIVATE_KEY=0x... OWNER_TO_REMOVE_ADDRESS=0x... npx hardhat run scripts/changeOwner/4.RemoveOwners.js --network <network>");
        return;
    }

    const deploymentFile = "deployed-addresses.json";
    if (!fs.existsSync(deploymentFile)) {
        console.error("Deployment file not found.");
        return;
    }
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile));

    if (
        !deploymentInfo.proxy ||
        !deploymentInfo.multiSig ||
        !deploymentInfo.implementation
    ) {
        throw new Error(
            "Missing required addresses in deployed-addresses.json (proxy, multiSig, or implementation)."
        );
    }

    // Create wallet from private key
    const provider = ethers.provider;
    const currentOwnerWallet = new ethers.Wallet(CURRENT_OWNER_PRIVATE_KEY, provider);

    console.log("--- Owner Removal Configuration ---");
    console.log("Current Owner Address:", currentOwnerWallet.address);
    console.log("Owner to Remove:", OWNER_TO_REMOVE_ADDRESS);

    const multiSigWalletAddress = deploymentInfo.multiSig;

    // Connect to MultiSigWallet
    const multiSigWallet = await ethers.getContractAt("MultiSigWallet", multiSigWalletAddress);
    console.log("Connected to MultiSigWallet at:", multiSigWalletAddress);

    // Get current multisig info
    const requiredApprovals = await multiSigWallet.required();
    console.log(`MultiSigWallet requires ${requiredApprovals} approvals.`);

    // List all existing owners
    console.log("\n--- Current MultiSig Owners ---");

    // Get all owners by calling the owners array until we hit an error
    const owners = [];
    let i = 0;
    try {
        while (true) {
            const ownerAddress = await multiSigWallet.owners(i);
            owners.push(ownerAddress);
            console.log(`Owner ${i + 1}: ${ownerAddress}`);
            i++;
        }
    } catch (error) {
        // This is expected when we reach the end of the array
    }

    console.log(`Total owners: ${owners.length}`);

    // Check if the current owner is actually an owner
    const isCurrentOwner = await multiSigWallet.isOwner(currentOwnerWallet.address);
    if (!isCurrentOwner) {
        throw new Error(`Address ${currentOwnerWallet.address} is not an owner of the MultiSigWallet`);
    }
    console.log(`✅ Confirmed: ${currentOwnerWallet.address} is a valid owner`);

    // Check if owner to remove is actually an owner
    const isOwnerToRemove = await multiSigWallet.isOwner(OWNER_TO_REMOVE_ADDRESS);
    if (!isOwnerToRemove) {
        throw new Error(`Address ${OWNER_TO_REMOVE_ADDRESS} is not an owner of the MultiSigWallet`);
    }
    console.log(`✅ Confirmed: ${OWNER_TO_REMOVE_ADDRESS} is a valid owner to remove`);

    // Check if removing would leave at least one owner
    if (owners.length <= 1) {
        throw new Error("Cannot remove the last owner of the MultiSigWallet");
    }
    console.log(`✅ Confirmed: There will still be ${owners.length - 1} owner(s) after removal`);

    // Check if required approvals would still be valid after removal
    if (requiredApprovals > owners.length - 1) {
        console.log(`⚠️  Warning: Required approvals (${requiredApprovals}) will exceed owner count (${owners.length - 1}) after removal`);
        console.log("The contract will automatically adjust required approvals to match the new owner count");
    }

    console.log("\n--- Submitting Remove Owner Transaction ---");
    console.log("Target Address:", multiSigWalletAddress);
    console.log("Owner to Remove:", OWNER_TO_REMOVE_ADDRESS);
    console.log("Value: 0 ETH");

    // Encode the removeOwner function call
    const removeOwnerData = multiSigWallet.interface.encodeFunctionData("removeOwner", [OWNER_TO_REMOVE_ADDRESS]);
    console.log("Encoded removeOwner data:", removeOwnerData);

    // Connect with the current owner's wallet
    const multiSigWalletConnected = multiSigWallet.connect(currentOwnerWallet);

    // Submit the transaction to call removeOwner on the MultiSigWallet itself
    const submitTx = await multiSigWalletConnected.submit(
        multiSigWalletAddress, // Target is the MultiSigWallet itself
        0,                     // No ETH value
        removeOwnerData        // Encoded removeOwner function call
    );

    const submitReceipt = await submitTx.wait();
    console.log("Transaction submitted. Tx Hash:", submitTx.hash);

    // Parse the 'Submit' event to get the transaction ID
    const submitEvent = submitReceipt.logs.find(
        (log) => multiSigWallet.interface.parseLog(log)?.name === "Submit"
    );
    if (!submitEvent) {
        throw new Error("Submit event not found in transaction receipt.");
    }
    const txId = submitEvent.args.txId;
    console.log(`Transaction ID: ${txId}`);

    // Append txId to deployment file
    deploymentInfo.removeOwnerTxId = txId.toString();
    deploymentInfo.removeOwnerTarget = OWNER_TO_REMOVE_ADDRESS;
    deploymentInfo.removeOwnerSubmittedBy = currentOwnerWallet.address;
    deploymentInfo.removeOwnerTimestamp = new Date().toISOString();

    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`✅ Transaction ID ${txId} saved to ${deploymentFile}`);

    console.log("\n--- Next Steps ---");
    console.log(`1. Other owners need to approve transaction ${txId}`);
    console.log(`2. Once ${requiredApprovals} approvals are reached, any owner can execute it`);
    console.log("3. Use the approve and execute functions with the transaction ID above");

    // Show current approval count
    const currentApprovals = await multiSigWallet.getApprovalCount(txId);
    console.log(`Current approvals: ${currentApprovals}/${requiredApprovals}`);

    console.log("\n--- Example commands for other owners ---");
    console.log(`// To approve: await multiSigWallet.connect(otherOwner).approve(${txId})`);
    console.log(`// To execute: await multiSigWallet.connect(anyOwner).execute(${txId})`);
    console.log(`// To run the approval script: npx hardhat run scripts/changeOwner/5.ApproveRemoveOwner.js --network <network>`);
}

main().catch(console.error);