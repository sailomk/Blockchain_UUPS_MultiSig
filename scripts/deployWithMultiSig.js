// scripts/deployWithMultisig.js
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
	// 1. Deploy MultiSig Wallet
	const owners = [
		process.env.OWNER1_ADDRESS,
		process.env.OWNER2_ADDRESS,
		process.env.OWNER3_ADDRESS,
	];
	const required = 2; // ต้องมี 2 ใน 3 คนเซ็น

	const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
	const multiSig = await MultiSigWallet.deploy(owners, required);
	await multiSig.waitForDeployment();

	console.log("MultiSigWallet deployed to:", await multiSig.getAddress());

	// 2. Deploy UUPS Implementation
	const MyContractV1 = await ethers.getContractFactory("MyContractV1");

	const accounts = await ethers.getSigners();
	console.log("Show account address", accounts[0].address);
	const myContractV1 = await upgrades.deployProxy(
		MyContractV1,
		[accounts[0].address],
		{
			initializer: "initialize",
			kind: "uups",
		}
	);

	await myContractV1.waitForDeployment();
	const proxyAddress = await myContractV1.getAddress();
	console.log("MyContract (UUPS proxy) deployed to:", proxyAddress);
	console.log(
		"MyContract (implementation) deployed to:",
		await upgrades.erc1967.getImplementationAddress(proxyAddress)
	);
	console.log("Owner is:", await myContractV1.owner());

	// 3. Transfer ownership to MultiSig
	await myContractV1.transferOwnership(await multiSig.getAddress());
	console.log("Ownership transferred to MultiSig");

	// Save addresses to file
	const addresses = {
		multiSig: await multiSig.getAddress(),
		proxy: await myContractV1.getAddress(),
		implementation: await upgrades.erc1967.getImplementationAddress(
			await myContractV1.getAddress()
		),
	};
	fs.writeFileSync(
		"deployed-addresses.json",
		JSON.stringify(addresses, null, 2)
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
