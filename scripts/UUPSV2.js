// scripts/upgrade_mycontract_v2.js
const { ethers, upgrades } = require("hardhat");

async function main() {
	// === CONFIGURATION ===
	// IMPORTANT: Replace this with the address of your deployed MyContractV1 PROXY
	const PROXY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
	// For local testing, you might deploy V1 first and then paste its proxy address here.
	// For Sepolia, use the actual deployed proxy address on Sepolia.
	// === END CONFIGURATION ===

	const [deployer] = await ethers.getSigners();
	console.log("Upgrading contracts with the account:", deployer.address);

	// Get the ContractFactory for MyContractV2
	const MyContractV2 = await ethers.getContractFactory("MyContractV2");

	console.log("Upgrading MyContract to V2...");

	// Perform the upgrade
	// The upgradeProxy function takes the address of the existing proxy
	// and the new ContractFactory (MyContractV2 in this case).
	const upgradedContract = await upgrades.upgradeProxy(
		PROXY_ADDRESS,
		MyContractV2
	);

	// Wait for the upgrade transaction to be mined
	await upgradedContract.waitForDeployment();

	const contractAddress = await upgradedContract.getAddress();
	console.log("MyContract (proxy) upgraded successfully at:", contractAddress);
	console.log(
		"New Implementation address:",
		await upgrades.erc1967.getImplementationAddress(contractAddress)
	);

	// Verify the version and preserved state
	const currentVersion = await upgradedContract.version();
	console.log("Contract version after upgrade:", currentVersion.toString());

	const currentValue = await upgradedContract.getValue();
	console.log("Value (preserved from V1):", currentValue.toString());

	// Check the new 'message' variable (should be default "Hello from V2" from constructor or empty if not explicitly set)
	const initialMessageV2 = await upgradedContract.getMessage();
	console.log("Initial message from V2:", initialMessageV2);

	// Example: Interacting with the new function after upgrade
	console.log("Setting new message...");
	const newMessageTx = await upgradedContract.setMessage(
		"Hello from the upgraded V2 contract!"
	);
	await newMessageTx.wait();
	const updatedMessage = await upgradedContract.getMessage();
	console.log("Updated message:", updatedMessage);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
