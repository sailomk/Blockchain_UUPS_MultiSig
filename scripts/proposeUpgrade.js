// scripts/proposeUpgradeWithMultiSig.js
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
	// 1. โหลดที่อยู่ที่บันทึกไว้
	const addresses = JSON.parse(fs.readFileSync("deployed-addresses.json"));

	// 2. เตรียมอัปเกรด
	const MyContractV2 = await ethers.getContractFactory("MyContractV2");
	console.log("Preparing upgrade...");
	const newImplementation = await upgrades.prepareUpgrade(
		addresses.proxy,
		MyContractV2
	);
	console.log("New implementation address:", newImplementation);

	// 3. เตรียมข้อมูลสำหรับ MultiSig
	const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(
		addresses.proxy
	);
	const proxyAdmin = await ethers.getContractAt(
		"ProxyAdmin",
		proxyAdminAddress
	);

	const upgradeData = proxyAdmin.interface.encodeFunctionData("upgrade", [
		addresses.proxy,
		newImplementation,
	]);

	// 4. ส่ง proposal ไปยัง MultiSig
	const multiSig = await ethers.getContractAt(
		"MultiSigWallet",
		addresses.multiSig
	);
	const tx = await multiSig.submit(proxyAdminAddress, 0, upgradeData);

	console.log("Transaction submitted to MultiSig:", tx.hash);
	console.log("Now the other owners need to approve the transaction");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
