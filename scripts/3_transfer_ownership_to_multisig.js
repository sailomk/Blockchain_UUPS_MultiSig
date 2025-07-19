// scripts/transfer_ownership_to_multisig.js
const { ethers, upgrades } = require("hardhat");

async function main() {
	// === CONFIGURATION ===
	const PROXY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // The address of your deployed V1 proxy
	const CUSTOM_MULTISIG_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // The address of your deployed SimpleMultisig
	// === END CONFIGURATION ===

	const [deployer] = await ethers.getSigners();
	console.log("Transferring ownership with account:", deployer.address);

	const MyContractV1 = await ethers.getContractFactory("MyContractV1");
	const myContractProxy = MyContractV1.attach(PROXY_ADDRESS);

	console.log(
		`Current owner of proxy ${PROXY_ADDRESS}: ${await myContractProxy.owner()}`
	);
	console.log(
		`Transferring ownership to Custom Multisig: ${CUSTOM_MULTISIG_ADDRESS}...`
	);

	const transferTx = await myContractProxy.transferOwnership(
		CUSTOM_MULTISIG_ADDRESS
	);
	await transferTx.wait();

	console.log("Ownership transfer initiated.");
	console.log(
		`New owner of proxy ${PROXY_ADDRESS}: ${await myContractProxy.owner()}`
	);
	console.log("Confirm this on Etherscan and manually verify.");
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
