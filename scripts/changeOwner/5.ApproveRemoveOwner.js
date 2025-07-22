// scripts/changeOwner/5.ApproveRemoveOwner.js
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const deploymentFile = "deployed-addresses.json";
    if (!fs.existsSync(deploymentFile)) {
        console.error("Deployment file not found.");
        return;
    }
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile));

    if (
        !deploymentInfo.proxy ||
        !deploymentInfo.multiSig ||
        !deploymentInfo.implementation ||
        !deploymentInfo.removeOwnerTxId
    ) {
        throw new Error(
            "Missing required addresses or removeOwnerTxId in deployed-addresses.json"
        );
    }

    const [owner1, owner2] = await ethers.getSigners();
    const multiSigWalletAddress = deploymentInfo.multiSig;

    const multiSigWallet = await ethers.getContractAt("MultiSigWallet", multiSigWalletAddress);
    console.log("Connected to MultiSigWallet at:", multiSigWalletAddress);

    const txId = deploymentInfo.removeOwnerTxId;
    const ownerToRemove = deploymentInfo.removeOwnerTarget;
    console.log(`Approving transaction ${txId} to remove owner ${ownerToRemove}...`);

    // List all existing owners before approval
    console.log("\n--- Current MultiSig Owners (Before) ---");
    const ownersBefore = [];
    let i = 0;
    try {
        while (true) {
            const ownerAddress = await multiSigWallet.owners(i);
            ownersBefore.push(ownerAddress);
            console.log(`Owner ${i + 1}: ${ownerAddress}`);
            i++;
        }
    } catch (error) {
        // This is expected when we reach the end of the array
    }
    console.log(`Total owners: ${ownersBefore.length}`);

    // Check current approval count
    const currentApprovals = await multiSigWallet.getApprovalCount(txId);
    const requiredApprovals = await multiSigWallet.required();
    console.log(`Current approvals: ${currentApprovals}/${requiredApprovals}`);

    // Owner 1 approves
    const approveTx = await multiSigWallet.connect(owner1).approve(txId);
    await approveTx.wait();
    console.log("Owner 1 approved transaction.");

    // Check approval count after approval
    const newApprovalCount = await multiSigWallet.getApprovalCount(txId);
    console.log(`Approvals after owner1: ${newApprovalCount}/${requiredApprovals}`);

    // If enough approvals are gathered, execute
    if (newApprovalCount >= requiredApprovals) {
        try {
            console.log("Sufficient approvals reached. Executing transaction...");

            // Get transaction details before executing
            const tx = await multiSigWallet.transactions(txId);
            console.log(`Transaction details:`);
            console.log(`- Target: ${tx.to}`);
            console.log(`- Value: ${tx.value.toString()}`);
            console.log(`- Data length: ${tx.data.length} bytes`);
            console.log(`- Executed: ${tx.executed}`);

            // Execute the transaction
            const executeTx = await multiSigWallet.connect(owner2).execute(txId);
            await executeTx.wait();
            console.log("Transaction executed successfully! Tx Hash:", executeTx.hash);

            // Check if the owner was actually removed
            const isStillOwner = await multiSigWallet.isOwner(ownerToRemove);
            if (!isStillOwner) {
                console.log(`✅ Success! ${ownerToRemove} has been removed as an owner.`);
            } else {
                console.log(`❌ Error: ${ownerToRemove} is still an owner.`);
                console.log("This could mean the transaction data was incorrect or the transaction failed silently.");
            }

            // Check if required approvals were adjusted
            const newRequiredApprovals = await multiSigWallet.required();
            if (newRequiredApprovals !== requiredApprovals) {
                console.log(`Required approvals adjusted from ${requiredApprovals} to ${newRequiredApprovals}`);
            }
        } catch (error) {
            console.error("Error executing transaction:", error.message);

            // If there's a specific error message, display it
            if (error.data) {
                const errorReason = error.data.replace("0x08c379a0", "");
                console.error("Error reason (hex):", errorReason);
            }

            console.log("\nTransaction execution failed. This could be due to:");
            console.log("1. The transaction data being incorrect");
            console.log("2. The target contract rejecting the transaction");
            console.log("3. Gas estimation issues");

            throw error; // Re-throw to stop execution
        }
    } else {
        console.log(`Need ${requiredApprovals - newApprovalCount} more approval(s) to execute.`);
    }

    // List all owners after execution
    console.log("\n--- Current MultiSig Owners (After) ---");
    const ownersAfter = [];
    i = 0;
    try {
        while (true) {
            const ownerAddress = await multiSigWallet.owners(i);
            ownersAfter.push(ownerAddress);
            console.log(`Owner ${i + 1}: ${ownerAddress}`);
            i++;
        }
    } catch (error) {
        // This is expected when we reach the end of the array
    }
    console.log(`Total owners: ${ownersAfter.length}`);

    // Show the new required approvals
    const finalRequiredApprovals = await multiSigWallet.required();
    console.log(`Required approvals: ${finalRequiredApprovals}`);
}

main().catch(console.error);