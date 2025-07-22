// scripts/deploy_mycontract_v1.js
const { ethers, upgrades } = require("hardhat");

async function main() {
	// Get the signers (accounts) from Hardhat
	const [deployer] = await ethers.getSigners();

	console.log("Deploying contracts with the account:", deployer.address);

	// Get the ContractFactory for MyContractV1
	const MyContractV1 = await ethers.getContractFactory("MyContractV1");

	// Deploy the UUPS proxy for MyContractV1
	// The initialize function will be called immediately after the proxy is deployed
	const myContractV1 = await upgrades.deployProxy(
		MyContractV1,
		[deployer.address],
		{
			kind: "uups", // Specify UUPS proxy type
		}
	);

	// Wait for the deployment transaction to be mined
	await myContractV1.waitForDeployment();

	const contractAddress = await myContractV1.getAddress();
	console.log("MyContractV1 deployed to:", contractAddress);
	console.log(
		"Implementation address:",
		await upgrades.erc1967.getImplementationAddress(contractAddress)
	);
	console.log(
		"Admin address:",
		await upgrades.erc1967.getAdminAddress(contractAddress)
	);

	// Verify initial values (optional)
	const initialValue = await myContractV1.getValue();
	console.log("Initial value of MyContractV1:", initialValue.toString());

	const contractVersion = await myContractV1.version();
	console.log("MyContractV1 version:", contractVersion.toString());

	const contractOwner = await myContractV1.owner();
	console.log("MyContractV1 owner:", contractOwner);

	// Example of interacting with the deployed contract (optional)
	// console.log("Setting value to 100...");
	// await myContractV1.setValue(100);
	// console.log("New value:", (await myContractV1.getValue()).toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
