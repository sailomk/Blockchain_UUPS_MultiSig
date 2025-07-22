// scripts/approveTransaction.js
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
        !deploymentInfo.changeOwnerTxId
    ) {
        throw new Error(
            "Missing required addresses in deployed-addresses.json (proxy, multiSig, or implementation)."
        );
    }


    const [owner1, owner2] = await ethers.getSigners();
    const multiSigWalletAddress = deploymentInfo.multiSig; // Your deployed MultiSigWallet address

    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    const multiSigWallet = MultiSigWallet.attach(multiSigWalletAddress);

    const txId = deploymentInfo.changeOwnerTxId; // The ID of the pending transaction (check getTransactionCount)

    console.log(`Approving transaction ${txId}...`);

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

            // The transaction should have already called addOwner if that's what was encoded
            // in the original transaction submitted by 2.ChangeOwners.js
            console.log(`\nNew owner ${deploymentInfo.changeOwnerTarget} should now be added.`);

            // Check if the new owner was actually added
            const isNewOwner = await multiSigWallet.isOwner(deploymentInfo.changeOwnerTarget);
            if (isNewOwner) {
                console.log(`✅ Success! ${deploymentInfo.changeOwnerTarget} is now an owner.`);
            } else {
                console.log(`❌ Error: ${deploymentInfo.changeOwnerTarget} was not added as an owner.`);
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
        console.log(`Need ${requiredApprovals - newApprovalCount} more approval(s) to execute.`);
    }

    // List all new owners
    console.log("\n--- Current MultiSig Owners after modify ---");

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
}

main().catch(console.error);