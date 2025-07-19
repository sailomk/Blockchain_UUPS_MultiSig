// scripts/upgradeToV2.js
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path"); // Import path module

async function main() {
	// ====================== 1. Load Previous Deployment ======================
	console.log("\n1. Loading previous deployment info...");

	const deploymentFile = "deployed-addresses.json";
	// Ensure the deploymentFile exists and contains the necessary addresses
	if (!fs.existsSync(deploymentFile)) {
		throw new Error(
			`Deployment file not found: ${deploymentFile}. Please run deploy_mycontract_v1.js first.`
		);
	}
	const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile));

	if (
		!deploymentInfo.proxy ||
		!deploymentInfo.multiSig ||
		!deploymentInfo.implementation
	) {
		throw new Error(
			"Missing required addresses in deployed-addresses.json (proxy, multiSig, or implementation)."
		);
	}

	console.log("Proxy address:", deploymentInfo.proxy);
	console.log("Current implementation:", deploymentInfo.implementation);
	console.log("MultiSig address:", deploymentInfo.multiSig);

	// ====================== 2. Prepare MultiSig Signers ======================
	console.log("\n2. Preparing MultiSig transaction...");

	// Get the signers for the multisig. Ensure these are the actual owners configured in your SimpleMultisig.
	const [signer1, signer2] = await ethers.getSigners(); // Assuming first two signers are owners

	// --- DIRECTLY LOAD MULTISIG ABI FROM ARTIFACT ---
	let multiSigABI;
	let multiSigBytecode; // To store bytecode for comparison
	try {
		const multiSigArtifactPath = path.resolve(
			__dirname,
			"../artifacts/contracts/SimpleMultisig.sol/SimpleMultisig.json"
		);
		if (!fs.existsSync(multiSigArtifactPath)) {
			throw new Error(
				`SimpleMultisig artifact not found at: ${multiSigArtifactPath}. Did you compile?`
			);
		}
		const multiSigArtifact = JSON.parse(fs.readFileSync(multiSigArtifactPath));
		multiSigABI = multiSigArtifact.abi;
		multiSigBytecode = multiSigArtifact.bytecode; // Get bytecode from artifact
		console.log("Debug: MultiSig ABI loaded directly from artifact.");
	} catch (error) {
		console.error("🚨 Error loading MultiSig ABI directly:", error.message);
		throw new Error(
			"Failed to load SimpleMultisig ABI. Please ensure it compiles correctly."
		);
	}
	// --- END DIRECT ABI LOADING ---

	// --- EXPLICITLY CREATE CONTRACT INSTANCE WITH LOADED ABI ---
	const multiSig = new ethers.Contract(
		deploymentInfo.multiSig,
		multiSigABI,
		signer1 // Connect with signer1 for submitting transactions
	);
	// --- END EXPLICIT CREATION ---

	console.log(`Using signers: ${signer1.address}, ${signer2.address}`);
	console.log(`Multisig contract address: ${await multiSig.getAddress()}`);

	// --- DIAGNOSTIC: COMPARE DEPLOYED BYTECODE WITH ARTIFACT BYTECODE ---
	console.log("\nDebug: Verifying deployed MultiSig contract bytecode...");
	const provider = ethers.provider;
	const deployedBytecode = await provider.getCode(deploymentInfo.multiSig);

	if (deployedBytecode === "0x") {
		throw new Error(
			`No contract deployed at MultiSig address: ${deploymentInfo.multiSig}.`
		);
	}

	// Compare a significant portion, as constructor args can make them slightly different at the end
	const minBytecodeLength = Math.min(
		deployedBytecode.length,
		multiSigBytecode.length
	);
	if (
		deployedBytecode.slice(0, minBytecodeLength) !==
		multiSigBytecode.slice(0, minBytecodeLength)
	) {
		console.error(
			"❌ Mismatch: Deployed MultiSig bytecode does NOT match artifact bytecode!"
		);
		console.error(
			"This indicates an old or incorrect contract might be deployed at the MultiSig address."
		);
		console.error("Deployed prefix:", deployedBytecode.slice(0, 100), "...");
		console.error("Artifact prefix:", multiSigBytecode.slice(0, 100), "...");
		throw new Error(
			"Deployed MultiSig bytecode mismatch. Please ensure you deployed the correct SimpleMultisig contract."
		);
	} else {
		console.log("✅ Deployed MultiSig bytecode matches artifact bytecode.");
	}
	// --- END DIAGNOSTIC ---

	// ====================== 3. Deploy New Implementation ======================
	console.log("\n3. Deploying MyContractV2 implementation...");

	const MyContractV2 = await ethers.getContractFactory("MyContractV2");
	// prepareUpgrade deploys the new implementation and performs storage layout checks
	const newImplementation = await upgrades.prepareUpgrade(
		deploymentInfo.proxy,
		MyContractV2
	);

	console.log("✅ New implementation deployed to:", newImplementation);

	// ====================== 4. Create Upgrade Transaction Calldata ======================
	console.log("\n4. Creating upgrade transaction calldata...");

	// Standard UUPS upgrade function ABI (from UUPSUpgradeable)
	const UUPSUpgradeableABI = [
		"function upgradeTo(address newImplementation) external",
	];
	const uupsInterface = new ethers.Interface(UUPSUpgradeableABI);
	const upgradeCallData = uupsInterface.encodeFunctionData("upgradeTo", [
		newImplementation,
	]);

	console.log("Upgrade call data for proxy:", upgradeCallData);

	// ====================== 5. Submit and Confirm to MultiSig ======================
	console.log("\n5. Submitting to MultiSig...");

	console.log(
		"Debug: multiSigABI is an array:",
		Array.isArray(multiSigABI) ? "Yes" : "No"
	);
	console.log(
		"Debug: multiSigABI length:",
		multiSigABI ? multiSigABI.length : "N/A"
	);

	// Use the appropriate function based on the MultiSig implementation (your SimpleMultisig uses submitTransaction)
	let tx1;
	// Check if the 'submitTransaction' function exists in the loaded ABI
	const submitTransactionFunctionExists = multiSigABI.some(
		(item) => item.type === "function" && item.name === "submitTransaction"
	);

	if (submitTransactionFunctionExists) {
		console.log(
			`Submitting transaction to MultiSig via 'submitTransaction' by ${signer1.address}...`
		);
		tx1 = await multiSig.submitTransaction(
			// multiSig is already connected to signer1
			deploymentInfo.proxy,
			0,
			upgradeCallData
		);
	} else {
		throw new Error(
			"MultiSig wallet does not have a 'submitTransaction' function in its ABI."
		);
	}

	await tx1.wait();
	console.log("Transaction submitted by signer1.");

	// Get the transaction ID (your SimpleMultisig uses getTransactionCount)
	let txId;
	const getTransactionCountFunctionExists = multiSigABI.some(
		(item) => item.type === "function" && item.name === "getTransactionCount"
	);

	if (getTransactionCountFunctionExists) {
		const txCount = await multiSig.getTransactionCount();
		txId = txCount - 1; // Assuming it's the last submitted transaction
		console.log(`Determined transaction ID: ${txId}`);
	} else {
		throw new Error(
			"Could not determine transaction ID from MultiSig (missing getTransactionCount in ABI)."
		);
	}

	// Second signer approves
	let tx2;
	const confirmTransactionFunctionExists = multiSigABI.some(
		(item) => item.type === "function" && item.name === "confirmTransaction"
	);

	if (confirmTransactionFunctionExists) {
		console.log(
			`Confirming transaction ${txId} via 'confirmTransaction' by ${signer2.address}...`
		);
		tx2 = await multiSig.connect(signer2).confirmTransaction(txId);
	} else {
		throw new Error(
			"MultiSig wallet does not have a 'confirmTransaction' function in its ABI."
		);
	}

	await tx2.wait();
	console.log("Transaction approved by signer2.");
	console.log(
		`Current confirmations for Tx ${txId}: ${(
			await multiSig.getTransaction(txId)
		).numConfirmations.toString()}`
	);
	console.log(
		`Required confirmations: ${(
			await multiSig.numConfirmationsRequired()
		).toString()}`
	);

	// ====================== 6. Verify Upgrade ======================
	console.log("\n6. Verifying upgrade...");

	// Give a moment for the transaction to propagate/execute if auto-execute is enabled
	// This is less critical with Hardhat local node, but good practice for real networks.
	// await new Promise((resolve) => setTimeout(resolve, 3000)); // Short delay

	const currentImpl = await upgrades.erc1967.getImplementationAddress(
		deploymentInfo.proxy
	);
	console.log("New implementation address (from proxy):", currentImpl);

	if (currentImpl.toLowerCase() === newImplementation.toLowerCase()) {
		console.log(
			"✅ Upgrade successful! Proxy now points to the new implementation."
		);

		// Verify new functionality
		const upgradedContract = await ethers.getContractAt(
			"MyContractV2",
			deploymentInfo.proxy // Attach to the proxy address
		);
		console.log(
			"Contract version (from V2):",
			await upgradedContract.version()
		);
		console.log(
			"Initial message (from V2):",
			await upgradedContract.getMessage()
		);
	} else {
		console.log("❌ Upgrade failed - implementation address mismatch!");
		console.log("Expected new implementation:", newImplementation);
		console.log("Actual implementation from proxy:", currentImpl);
		throw new Error("Upgrade verification failed.");
	}

	// ====================== 7. Update Deployment Info ======================
	deploymentInfo.implementation = newImplementation; // Update to the new implementation address
	deploymentInfo.upgradeTimestamp = new Date().toISOString();

	fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

	console.log("\n📄 Updated deployment info saved to deployed-addresses.json");
}

main().catch((error) => {
	console.error("🚨 Upgrade failed:", error);
	process.exitCode = 1;
});
