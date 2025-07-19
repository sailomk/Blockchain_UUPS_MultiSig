const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
	// ====================== 1. Deploy MultiSig Wallet ======================
	console.log("\n1. Deploying MultiSig Wallet...");

	// Multisig configuration - replace with your addresses
	const owners = [
		"0x90F79bf6EB2c4f870365E785982E1f101E93b906", // Owner 1
		"0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // Owner 2
		"0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", // Owner 3
	];
	const requiredConfirmations = 2; // 2/3 multisig

	const MultiSigWallet = await ethers.getContractFactory("SimpleMultisig");
	const multiSig = await MultiSigWallet.deploy(owners, requiredConfirmations);
	await multiSig.waitForDeployment();

	const multiSigAddress = await multiSig.getAddress();
	console.log("✅ MultiSig Wallet deployed to:", multiSigAddress);

	// ====================== 2. Deploy UUPS Upgradeable Contract ======================
	console.log("\n2. Deploying UUPS Upgradeable Contract...");

	const MyContractV1 = await ethers.getContractFactory("MyContractV1");
	const [deployer] = await ethers.getSigners();

	console.log("Using deployer address:", deployer.address);

	// Using OpenZeppelin's plugin for safer deployment
	const myContract = await upgrades.deployProxy(
		MyContractV1,
		[deployer.address], // Initializer arguments
		{
			initializer: "initialize", // Initializer function
			kind: "uups", // UUPS upgrade pattern
		}
	);
	await myContract.waitForDeployment();

	const proxyAddress = await myContract.getAddress();
	const implementationAddress = await upgrades.erc1967.getImplementationAddress(
		proxyAddress
	);

	console.log("✅ Proxy deployed to:", proxyAddress);
	console.log("✅ Implementation deployed to:", implementationAddress);
	console.log("Current owner:", await myContract.owner());

	// ====================== 3. Transfer Ownership to MultiSig ======================
	console.log("\n3. Transferring ownership to MultiSig...");

	const transferTx = await myContract.transferOwnership(multiSigAddress);
	await transferTx.wait();
	console.log("✅ Ownership transferred to MultiSig");
	console.log("New owner:", await myContract.owner());

	// ====================== 4. Save Deployment Info ======================
	const deploymentInfo = {
		network: network.name,
		multiSig: multiSigAddress,
		proxy: proxyAddress,
		implementation: implementationAddress,
		timestamp: new Date().toISOString(),
	};

	fs.writeFileSync(
		"deployed-addresses.json",
		JSON.stringify(deploymentInfo, null, 2)
	);

	console.log("\n📄 Deployment info saved to deployed-addresses.json");
}

main().catch((error) => {
	console.error("🚨 Deployment failed:", error);
	process.exitCode = 1;
});
