// scripts/propose_upgrade_via_multisig.js
const { ethers, upgrades } = require("hardhat");

async function main() {
	// === CONFIGURATION ===
	const PROXY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // The address of your deployed V1 proxy
	const CUSTOM_MULTISIG_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // The address of your deployed SimpleMultisig

	// Configuration for upgradeToAndCall
	const USE_UPGRADE_TO_AND_CALL = true; // Set to false to use simple upgradeTo
	const INITIALIZATION_FUNCTION = "setMessage"; // Function to call after upgrade
	const INITIALIZATION_PARAMS = ["Upgraded to V2 via MultiSig!"]; // Parameters for the function

	// This script should be run by one of the multisig owners (e.g., owner1)
	const [deployer, owner1] = await ethers.getSigners(); // Make sure owner1 is one of the multisig owners
	// === END CONFIGURATION ===

	console.log("Preparing and proposing upgrade with account:", owner1.address);

	// 1. Deploy the new implementation contract (MyContractV2)
	// This step can be done by any EOA, it doesn't need to be a multisig owner
	const MyContractV2 = await ethers.getContractFactory("MyContractV2");
	const myContractV2Implementation = await MyContractV2.deploy();
	await myContractV2Implementation.waitForDeployment();
	const newImplementationAddress =
		await myContractV2Implementation.getAddress();
	console.log(
		"MyContractV2 implementation deployed to:",
		newImplementationAddress
	);

	// 2. Prepare the upgrade transaction data for the UUPS proxy
	// Get the interface for the UUPSUpgradeable functions
	const UUPSUpgradeableABI = [
		"function upgradeTo(address newImplementation)",
		"function upgradeToAndCall(address newImplementation, bytes memory data) external payable",
	];
	const proxyInterface = new ethers.Interface(UUPSUpgradeableABI);

	let calldataForProxyUpgrade;

	if (USE_UPGRADE_TO_AND_CALL) {
		// Prepare the initialization call data for the new implementation
		const MyContractV2Interface = new ethers.Interface([
			"function setMessage(string memory _newMessage)",
			"function setValue(uint256 _newValue)",
			// Add other functions you might want to call during upgrade
		]);

		const initCalldata = MyContractV2Interface.encodeFunctionData(
			INITIALIZATION_FUNCTION,
			INITIALIZATION_PARAMS
		);

		console.log("Initialization function:", INITIALIZATION_FUNCTION);
		console.log("Initialization parameters:", INITIALIZATION_PARAMS);
		console.log("Encoded initialization calldata:", initCalldata);

		// Encode the calldata for `upgradeToAndCall`
		calldataForProxyUpgrade = proxyInterface.encodeFunctionData(
			"upgradeToAndCall",
			[newImplementationAddress, initCalldata]
		);

		console.log("Using upgradeToAndCall for upgrade with initialization");
	} else {
		// Encode the calldata for the simple `upgradeTo` function
		calldataForProxyUpgrade = proxyInterface.encodeFunctionData(
			"upgradeTo",
			[newImplementationAddress]
		);

		console.log("Using simple upgradeTo for upgrade");
	}

	console.log(
		"Hardhat Script: Generated calldata for proxy upgrade:",
		calldataForProxyUpgrade
	);
	console.log(
		"Hardhat Script: Length of generated calldata:",
		calldataForProxyUpgrade.length
	);
	console.log(
		"Hardhat Script: Target proxy address for calldata:",
		PROXY_ADDRESS
	);

	// 3. Connect to the SimpleMultisig contract
	const SimpleMultisig = await ethers.getContractFactory("SimpleMultisig");
	const simpleMultisig = SimpleMultisig.attach(CUSTOM_MULTISIG_ADDRESS).connect(
		owner1
	); // Connect with one of the owners

	console.log("\n--- Proposing Transaction to SimpleMultisig ---");
	console.log("Target (Proxy) Address:", PROXY_ADDRESS);
	console.log("Value (ETH): 0");
	console.log("Calldata (for proxy upgradeTo):", calldataForProxyUpgrade);

	// Submit the transaction to the multisig contract
	const submitTx = await simpleMultisig.submitTransaction(
		PROXY_ADDRESS, // Target: The UUPS proxy contract
		0, // Value: 0 ETH for an upgrade
		calldataForProxyUpgrade // The encoded data to call `upgradeTo` on the proxy
	);
	await submitTx.wait();

	const txCount = await simpleMultisig.getTransactionCount();
	const newTxId = Number(txCount) - 1; // The ID of the newly submitted transaction
	console.log(`Transaction proposed to SimpleMultisig with ID: ${newTxId}`);
	console.log(`Transaction submitted by: ${owner1.address}`);

	// Optional: Verify the upgrade would be valid (storage layout check)
	/* 	try {
		await upgrades.prepareUpgrade(PROXY_ADDRESS, MyContractV2);
		console.log(
			"\nOpenZeppelin Upgrades storage layout check passed for the upgrade."
		);
	} catch (error) {
		console.error(
			"\nStorage layout check failed! Review your V2 contract:",
			error.message
		);
		process.exit(1);
	} */
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
