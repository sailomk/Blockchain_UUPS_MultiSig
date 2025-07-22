// scripts/changeOwner/6.ChangeRequirement.js
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    // --- Configuration ---
    // IMPORTANT: Replace these with the actual values you want to use
    const CURRENT_OWNER_PRIVATE_KEY = process.env.CURRENT_OWNER_PRIVATE_KEY; // Private key of current owner
    const NEW_REQUIRED_APPROVALS = process.env.NEW_REQUIRED_APPROVALS; // New number of required approvals

    if (!CURRENT_OWNER_PRIVATE_KEY) {
        console.error("Please set CURRENT_OWNER_PRIVATE_KEY environment variable");
        console.log("Usage: CURRENT_OWNER_PRIVATE_KEY=0x... NEW_REQUIRED_APPROVALS=2 npx hardhat run scripts/changeOwner/6.ChangeRequirement.js --network <network>");
        return;
    }

    if (!NEW_REQUIRED_APPROVALS) {
        console.error("Please set NEW_REQUIRED_APPROVALS environment variable");
        console.log("Usage: CURRENT_OWNER_PRIVATE_KEY=0x... NEW_REQUIRED_APPROVALS=2 npx hardhat run scripts/changeOwner/6.ChangeRequirement.js --network <network>");
        return;
    }

    // Convert to number and validate
    const newRequiredApprovals = parseInt(NEW_REQUIRED_APPROVALS);
    if (isNaN(newRequiredApprovals) || newRequiredApprovals <= 0) {
        console.error("NEW_REQUIRED_APPROVALS must be a positive number");
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

    console.log("--- Change Requirement Configuration ---");
    console.log("Current Owner Address:", currentOwnerWallet.address);
    console.log("New Required Approvals:", newRequiredApprovals);

    const multiSigWalletAddress = deploymentInfo.multiSig;

    // Connect to MultiSigWallet
    const multiSigWallet = await ethers.getContractAt("MultiSigWallet", multiSigWalletAddress);
    console.log("Connected to MultiSigWallet at:", multiSigWalletAddress);

    // Get current multisig info
    const currentRequiredApprovals = await multiSigWallet.required();
    console.log(`Current required approvals: ${currentRequiredApprovals}`);

    // List all existing owners
    console.log("\n--- Current MultiSig Owners ---");
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

    // Check if new requirement is valid
    if (newRequiredApprovals > owners.length) {
        throw new Error(`New required approvals (${newRequiredApprovals}) cannot exceed the number of owners (${owners.length})`);
    }
    console.log(`✅ Confirmed: New requirement (${newRequiredApprovals}) is valid for ${owners.length} owners`);

    console.log("\n--- Submitting Change Requirement Transaction ---");
    console.log("Target Address:", multiSigWalletAddress);
    console.log("New Required Approvals:", newRequiredApprovals);
    console.log("Value: 0 ETH");

    // Encode the changeRequirement function call
    const changeRequirementData = multiSigWallet.interface.encodeFunctionData("changeRequirement", [newRequiredApprovals]);
    console.log("Encoded changeRequirement data:", changeRequirementData);

    // Connect with the current owner's wallet
    const multiSigWalletConnected = multiSigWallet.connect(currentOwnerWallet);

    // Submit the transaction to call changeRequirement on the MultiSigWallet itself
    const submitTx = await multiSigWalletConnected.submit(
        multiSigWalletAddress, // Target is the MultiSigWallet itself
        0,                     // No ETH value
        changeRequirementData  // Encoded changeRequirement function call
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
    deploymentInfo.changeRequirementTxId = txId.toString();
    deploymentInfo.newRequiredApprovals = newRequiredApprovals;
    deploymentInfo.changeRequirementSubmittedBy = currentOwnerWallet.address;
    deploymentInfo.changeRequirementTimestamp = new Date().toISOString();

    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`✅ Transaction ID ${txId} saved to ${deploymentFile}`);

    console.log("\n--- Next Steps ---");
    console.log(`1. Other owners need to approve transaction ${txId}`);
    console.log(`2. Once ${currentRequiredApprovals} approvals are reached, any owner can execute it`);
    console.log("3. Use the approve and execute functions with the transaction ID above");

    // Show current approval count
    const currentApprovals = await multiSigWallet.getApprovalCount(txId);
    console.log(`Current approvals: ${currentApprovals}/${currentRequiredApprovals}`);

    console.log("\n--- Example commands for other owners ---");
    console.log(`// To approve: await multiSigWallet.connect(otherOwner).approve(${txId})`);
    console.log(`// To execute: await multiSigWallet.connect(anyOwner).execute(${txId})`);
    console.log(`// To run the approval script: npx hardhat run scripts/changeOwner/7.ApproveChangeRequirement.js --network <network>`);
}

main().catch(console.error);