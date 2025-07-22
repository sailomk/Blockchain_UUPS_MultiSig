// scripts/deploy.js
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // --- 1. Deploy MultiSigWallet ---
    // For demonstration, let's use a couple of Hardhat's default signers as owners
    const signers = await ethers.getSigners();
    const ownerAddresses = signers.slice(0, 2).map((signer) => signer.address); // Use first two signers as owners
    const requiredApprovals = 1; // For testing, set a low requirement

    console.log("MultiSigWallet owners:", ownerAddresses);
    console.log("Required approvals for MultiSigWallet:", requiredApprovals);

    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    const multiSigWallet = await MultiSigWallet.deploy(
        ownerAddresses,
        requiredApprovals
    );
    await multiSigWallet.waitForDeployment();
    const multiSigWalletAddress = await multiSigWallet.getAddress();
    console.log("MultiSigWallet deployed to:", multiSigWalletAddress);

    // --- 2. Deploy MyContractV1 (UUPS Proxy) with MultiSigWallet as the owner ---
    const MyContractV1 = await ethers.getContractFactory("MyContractV1");

    // Deploy the UUPS proxy, with MultiSigWallet as the owner
    // The initialize function of MyContractV1 will be called with the MultiSigWallet's address
    const myContractV1Proxy = await upgrades.deployProxy(
        MyContractV1,
        //[deployer.address],
        [multiSigWalletAddress], // The 'owner' parameter for initialize(address owner) in MyContractV1
        {
            kind: "uups",
            initializer: "initialize", // Specify the initializer function
        }
    );
    await myContractV1Proxy.waitForDeployment();
    const myContractV1ProxyAddress = await myContractV1Proxy.getAddress();
    console.log(
        "MyContractV1 (UUPS Proxy) deployed to:",
        myContractV1ProxyAddress
    );

    // Get the implementation address (optional, for verification)
    const myContractV1ImplementationAddress =
        await upgrades.erc1967.getImplementationAddress(myContractV1ProxyAddress);
    console.log(
        "MyContractV1 Implementation deployed to:",
        myContractV1ImplementationAddress
    );

    // --- Verify Ownership ---
    const myContractV1 = await ethers.getContractAt(
        "MyContractV1",
        myContractV1ProxyAddress
    );
    const proxyOwner = await myContractV1.owner();
    console.log("Owner of MyContractV1 Proxy:", proxyOwner);

    if (proxyOwner === multiSigWalletAddress) {
        console.log(
            "Successfully set MultiSigWallet as the owner of MyContractV1 Proxy!"
        );
    } else {
        console.log(
            "Failed to set MultiSigWallet as the owner of MyContractV1 Proxy."
        );
    }
    // --- Save Addresses ---

    const deploymentInfo = {
        network: network.name,
        multiSig: multiSigWalletAddress,
        proxy: myContractV1ProxyAddress,
        implementation: myContractV1ImplementationAddress,
        timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(
        "deployed-addresses.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
