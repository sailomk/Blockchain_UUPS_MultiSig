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

    // Owner 1 approves
    await multiSigWallet.connect(owner1).confirmTransaction(txId);
    console.log("Owner 1 approved transaction.");

    // If enough approvals are gathered, execute
    const tx = await multiSigWallet.connect(owner2).executeTransaction(txId);
    console.log("Transaction executed. Tx Hash:", tx.hash);
}

main().catch(console.error);