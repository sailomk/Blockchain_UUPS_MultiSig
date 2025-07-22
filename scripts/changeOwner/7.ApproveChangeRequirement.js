// scripts/changeOwner/7.ApproveChangeRequirement.js
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
        !deploymentInfo.changeRequirementTxId
    ) {
        throw new Error(
            "Missing required addresses or changeRequirementTxId in deployed-addresses.json"
        );
    }

    const [owner1, owner2] = await ethers.getSigners();
    const multiSigWalletAddress = deploymentInfo.multiSig;

    const multiSigWallet = await ethers.getContractAt("MultiSigWallet", multiSigWalletAddress);
    console.log("Connected to MultiSigWallet at:", multiSigWalletAddress);

    const txId = deploymentInfo.changeRequirementTxId;
    const newRequiredApprovals = deploymentInfo.newRequiredApprovals;
    console.log(`Approving transaction ${txId} to change required approvals to ${newRequiredApprovals}...`);

    // Get current required approvals
    const currentRequiredApprovals = await multiSigWallet.required();
    console.log(`Current required approvals: ${currentRequiredApprovals}`);

    // Check current approval count
    const currentApprovals = await multiSigWallet.getApprovalCount(txId);
    console.log(`Current approvals: ${currentApprovals}/${currentRequiredApprovals}`);

    // Owner 1 approves
    const approveTx = await multiSigWallet.connect(owner1).approve(txId);
    await approveTx.wait();
    console.log("Owner 1 approved transaction.");

    // Check approval count after approval
    const newApprovalCount = await multiSigWallet.getApprovalCount(txId);
    console.log(`Approvals after owner1: ${newApprovalCount}/${currentRequiredApprovals}`);

    // If enough approvals are gathered, execute
    if (newApprovalCount >= currentRequiredApprovals) {
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

            // Check if the requirement was actually changed
            const updatedRequiredApprovals = await multiSigWallet.required();
            if (updatedRequiredApprovals == newRequiredApprovals) {
                console.log(`✅ Success! Required approvals changed from ${currentRequiredApprovals} to ${updatedRequiredApprovals}`);
            } else {
                console.log(`❌ Error: Required approvals are still ${updatedRequiredApprovals}, not ${newRequiredApprovals}`);
                console.log("This could mean the transaction data was incorrect or the transaction failed silently.");
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
        console.log(`Need ${currentRequiredApprovals - newApprovalCount} more approval(s) to execute.`);
    }

    // List all owners and show the new required approvals
    console.log("\n--- Current MultiSig Configuration ---");
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

    const finalRequiredApprovals = await multiSigWallet.required();
    console.log(`Required approvals: ${finalRequiredApprovals}`);
}

main().catch(console.error);