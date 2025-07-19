// scripts/deploy_simple_multisig.js
const { ethers } = require("hardhat");

async function main() {
	const [deployer, owner1, owner2, owner3] = await ethers.getSigners();
	console.log("Deploying SimpleMultisig with account:", deployer.address);

	// Define the owners and required confirmations for your multisig
	const owners = [owner1.address, owner2.address, owner3.address]; // Example: 3 owners
	const numConfirmationsRequired = 2; // Example: 2 out of 3 required

	console.log("Multisig Owners:", owners);
	console.log("Required Confirmations:", numConfirmationsRequired);

	const SimpleMultisig = await ethers.getContractFactory("SimpleMultisig");
	const simpleMultisig = await SimpleMultisig.deploy(
		owners,
		numConfirmationsRequired
	);

	await simpleMultisig.waitForDeployment();
	const multisigAddress = await simpleMultisig.getAddress();

	console.log("SimpleMultisig deployed to:", multisigAddress);
	console.log("Owner 1 (for testing):", owner1.address);
	console.log("Owner 2 (for testing):", owner2.address);
	console.log("Owner 3 (for testing):", owner3.address);

	// Verify
	const deployedOwners = await simpleMultisig.getOwners();
	console.log("Deployed Owners from contract:", deployedOwners);
	const deployedRequired = await simpleMultisig.numConfirmationsRequired();
	console.log("Deployed Required Confirmations:", deployedRequired.toString());
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
