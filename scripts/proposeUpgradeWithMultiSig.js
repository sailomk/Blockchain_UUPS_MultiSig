const { ethers, upgrades } = require("hardhat");
const addresses = require("../deployed-addresses.json");

const UUPS_ABI = [
	"function upgradeTo(address newImplementation) external",
	"function upgradeToAndCall(address newImplementation, bytes memory data) external payable",
];

async function main() {
	// v5.x upgrades plugin handles UUPS safety checks automatically
	const MyContractV2 = await ethers.getContractFactory("MyContractV2");
	const proxyAddress = addresses.proxy;
	const multiSigAddress = addresses.multiSig;
	console.log("Proxy address: ", proxyAddress);
	//	console.log("owner address ", MyContractV2);
	//console.log("MultiSig address", addresses.multiSig);
	/* 	const newImpl = await upgrades.prepareUpgrade(proxyAddress, MyContractV2, {
		kind: "uups",
		unsafeAllow: ["constructor"], // Required for v5.x constructor pattern
	}); */
	const MyContractV2Connected = MyContractV2.connect([multiSigAddress]);

	const newImpl = await upgrades.prepareUpgrade(proxyAddress, MyContractV2, {
		kind: "uups",
		unsafeAllow: ["constructor"],
	});
	// console.log("New implementation address:", newImpl);
	//const multiSig = await ethers.getContractAt("MultiSigWallet", multiSigAddress);
	//const upgradeData = proxy.interface.encodeFunctionData("upgradeTo", [newImpl]);

	//await multiSig.submit(proxyAddress, 0, upgradeData); // Submit to MultiSig for approval

	/*
	upgradedContract = await upgrades.upgradeProxy(
		proxyAddress,
		MyContractV2Connected
	);
	upgradedContract.waitForDeployment();

	newImpl = await upgrades.erc1976.getImplementationAddress(proxyAddress);
    */

	console.log("MyContract (UUPS Proxy) upgraded!");
	console.log("New implementation deployed to:", newImpl);
	//console.log("Value after upgrade:", await upgradedContract.getValue());
	console.log(
		"Message (new V2 function):"
		//	await upgradedContract.getMessage()
	);

	console.log("Send the tx to multiSig contract");
	// MultiSig interaction remains the same
	const multiSig = await ethers.getContractAt(
		"MultiSigWallet",
		multiSigAddress
	);
	const proxy = await ethers.getContractAt("MyContractV1", addresses.proxy);
	const upgradeData = proxy.interface.encodeFunctionData("upgradeToAndCall", [
		newImpl,
	]);

	await multiSig.submit(proxyAddress, 0, upgradeData);
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
