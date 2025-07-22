// scripts/changeOwners.js
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    // --- Configuration ---
    // IMPORTANT: Replace these with the actual addresses you want to use
    const CURRENT_OWNER_PRIVATE_KEY = process.env.CURRENT_OWNER_PRIVATE_KEY; // Private key of current owner
    const NEW_OWNER_ADDRESS = process.env.NEW_OWNER_ADDRESS; // Address of new owner to add

    // Alternative: You can also hardcode addresses for testing (NOT recommended for production)
    // const CURRENT_OWNER_ADDRESS = "0x..."; // Current owner address
    // const NEW_OWNER_ADDRESS = "0x..."; // New owner address

    if (!CURRENT_OWNER_PRIVATE_KEY) {
        console.error("Please set CURRENT_OWNER_PRIVATE_KEY environment variable");
        console.log("Usage: CURRENT_OWNER_PRIVATE_KEY=0x... NEW_OWNER_ADDRESS=0x... npx hardhat run scripts/changeOwners.js --network <network>");
        return;
    }

    if (!NEW_OWNER_ADDRESS) {
        console.error("Please set NEW_OWNER_ADDRESS environment variable");
        console.log("Usage: CURRENT_OWNER_PRIVATE_KEY=0x... NEW_OWNER_ADDRESS=0x... npx hardhat run scripts/changeOwners.js --network <network>");
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

    console.log("--- Owner Change Configuration ---");
    console.log("Current Owner Address:", currentOwnerWallet.address);
    console.log("New Owner Address:", NEW_OWNER_ADDRESS);

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

    // Check if new owner is already an owner
    const isNewOwnerAlready = await multiSigWallet.isOwner(NEW_OWNER_ADDRESS);
    if (isNewOwnerAlready) {
        console.log(`⚠️  Warning: ${NEW_OWNER_ADDRESS} is already an owner of the MultiSigWallet`);
    } else {
        console.log(`✅ Confirmed: ${NEW_OWNER_ADDRESS} is not currently an owner`);
    }

    console.log("\n--- Submitting Add Owner Transaction ---");
    console.log("Target Address:", multiSigWalletAddress);
    console.log("New Owner to Add:", NEW_OWNER_ADDRESS);
    console.log("Value: 0 ETH");

    // Encode the addOwner function call
    const addOwnerData = multiSigWallet.interface.encodeFunctionData("addOwner", [NEW_OWNER_ADDRESS]);
    console.log("Encoded addOwner data:", addOwnerData);

    // Connect with the current owner's wallet
    const multiSigWalletConnected = multiSigWallet.connect(currentOwnerWallet);

    // Submit the transaction to call addOwner on the MultiSigWallet itself
    const submitTx = await multiSigWalletConnected.submit(
        multiSigWalletAddress, // Target is the MultiSigWallet itself
        0,                     // No ETH value
        addOwnerData          // Encoded addOwner function call
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
    deploymentInfo.changeOwnerTxId = txId.toString();
    deploymentInfo.changeOwnerTarget = NEW_OWNER_ADDRESS;
    deploymentInfo.changeOwnerSubmittedBy = currentOwnerWallet.address;
    deploymentInfo.changeOwnerTimestamp = new Date().toISOString();

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
}


main().catch(console.error);
