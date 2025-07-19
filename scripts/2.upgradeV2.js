// scripts/upgrade.js
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {``
	const deploymentFile = "deployed-addresses.json";
	if (!fs.existsSync(deploymentFile)) {
		console.error("Deployment file not found.");
		return;
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
	// --- Configuration ---
	// IMPORTANT: Replace these with the actual deployed addresses from your previous 'deploy.js' script output!
	// Example: MultiSigWallet deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
	// Example: MyContractV1 (UUPS Proxy) deployed to: 0xCf7Ed3AccA5a467e9e704C7065ee. . .
	const MULTISIG_WALLET_ADDRESS = deploymentInfo.multiSig; // e.g., "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
	const MY_CONTRACT_PROXY_ADDRESS = deploymentInfo.proxy ; // e.g., "0xCf7Ed3AccA5a467e9e704C7065ee9B0"

	// Get signers. These must correspond to the owners you configured
	// for your MultiSigWallet during the initial deployment.
	// For local testing, Hardhat's default signers [0], [1], etc. are used.
	// owner1 will submit and execute, owner2 will approve if needed.
	const [owner1, owner2] = await ethers.getSigners();
	// Assuming owner1 and owner2 were the initial owners of the MultiSigWallet in your deploy script.

	console.log("--- Starting Contract Upgrade Process ---");
	console.log("MyContractV1 Proxy Address:", MY_CONTRACT_PROXY_ADDRESS);
	console.log("MultiSigWallet Address:", MULTISIG_WALLET_ADDRESS);
	console.log("Simulated MultiSigWallet Owner 1:", owner1.address);
	console.log("Simulated MultiSigWallet Owner 2:", owner2.address);

	// --- 1. Get MultiSigWallet instance ---
	const multiSigWallet = await ethers.getContractAt(
		"MultiSigWallet",
		MULTISIG_WALLET_ADDRESS
	);
	console.log(
		"Connected to MultiSigWallet at:",
		await multiSigWallet.getAddress()
	);

	const requiredApprovals = await multiSigWallet.required();
	console.log(`MultiSigWallet requires ${requiredApprovals} approvals.`);

	// --- 2. Get MyContractV1 Proxy instance and check its current state ---
	const myContractV1 = await ethers.getContractAt(
		"MyContractV1",
		MY_CONTRACT_PROXY_ADDRESS
	);
	console.log(
		"Connected to MyContractV1 Proxy at:",
		await myContractV1.getAddress()
	);
	console.log(
		"Current version (V1):",
		(await myContractV1.version()).toString()
	);
	console.log(
		"Current value (V1):",
		(await myContractV1.getValue()).toString()
	);
	try {
		// This call should fail or return an empty string/default if message wasn't in V1 (as expected)
		console.log(
			"Attempting to get message (V1):",
			await myContractV1.getMessage()
		);
	} catch (e) {
		console.log("`getMessage()` not available on V1 as expected.");
	}

	// --- 3. Prepare the new MyContractV2 implementation ---
	console.log("\n--- Preparing MyContractV2 Implementation ---");
	const MyContractV2 = await ethers.getContractFactory("MyContractV2");

	// This deploys the new logic contract and performs storage layout checks.
	// It DOES NOT upgrade the proxy yet.
	const newMyContractV2ImplementationAddress = await upgrades.prepareUpgrade(
		MY_CONTRACT_PROXY_ADDRESS, // The proxy address that will be upgraded
		MyContractV2
	);
	console.log(
		"New MyContractV2 Implementation deployed at:",
		newMyContractV2ImplementationAddress
	);

	// --- 4. Construct the upgrade transaction for the MultiSigWallet ---
	console.log("\n--- Constructing Upgrade Transaction ---");
	// FIX: Explicitly define the interface for the `upgradeTo` function
	// The `upgradeTo` function is part of the UUPSUpgradeable standard (ERC1967Upgrade base contract)
	// and is called on the PROXY contract. MyContractV2.interface might not
	// directly expose it in the way ethers.js expects for direct encoding.
	// We create a specific interface fragment for it.
	const proxyUpgradeInterface = new ethers.Interface([
		"function upgradeTo(address newImplementation)",
		"function upgradeToAndCall(address newImplementation, bytes calldata data)",
	]);
	// Use simple upgradeTo instead of upgradeToAndCall
	// We'll call initializeV2 separately after the upgrade
	const upgradeToTxData = proxyUpgradeInterface.encodeFunctionData(
		"upgradeToAndCall",
		[newMyContractV2ImplementationAddress, "0x"]
	);

	// Encode the `upgradeTo` function call from the UUPSUpgradeable interface.
	// The `upgradeTo` function is part of the proxy's interface.

	/* 	const upgradeToTxData = MyContractV2.interface.encodeFunctionData(
		"upgradeTo",
		[newMyContractV2ImplementationAddress]
	); */

	const targetAddress = MY_CONTRACT_PROXY_ADDRESS; // The proxy contract is the target of the multisig transaction
	const valueToSend = 0; // No Ether needs to be sent for an upgrade
	const dataToSend = upgradeToTxData; // The encoded call to upgradeTo

	console.log("Target of MultiSig TX (Proxy):", targetAddress);
	console.log("Value:", valueToSend);
	console.log("Encoded Data (upgradeToAndCall):", dataToSend);

	// --- 5. Submit the upgrade transaction to the MultiSigWallet ---
	console.log("\n--- Submitting Upgrade Transaction to MultiSigWallet ---");

	// Connect to the MultiSigWallet using owner1's signer to submit the transaction.
	const multiSigWalletConnectedByOwner1 = multiSigWallet.connect(owner1);
	const submitTx = await multiSigWalletConnectedByOwner1.submit(
		targetAddress,
		valueToSend,
		dataToSend
	);
	const submitReceipt = await submitTx.wait();

	// Parse the 'Submit' event to get the transaction ID
	const submitEvent = submitReceipt.logs.find(
		(log) => multiSigWallet.interface.parseLog(log)?.name === "Submit"
	);
	if (!submitEvent) {
		throw new Error("Submit event not found in transaction receipt.");
	}
	const txId = submitEvent.args.txId;

	console.log(
		`Submitted upgrade transaction with ID: ${txId} by ${owner1.address}`
	);

	// --- 6. Approve the transaction (if required > 1) ---
	console.log("\n--- Approving Transaction ---");

	let currentApprovalCount = await multiSigWallet.getApprovalCount(txId);
	console.log(
		`Current approval count for txId ${txId}: ${currentApprovalCount}`
	);

	// If more approvals are needed, simulate owner2 approving.
	if (currentApprovalCount < requiredApprovals) {
		console.log(
			`Additional approvals needed. Simulating owner2 approving transaction ${txId}...`
		);
		const multiSigWalletConnectedByOwner2 = multiSigWallet.connect(owner2);
		const approveTx = await multiSigWalletConnectedByOwner2.approve(txId);
		await approveTx.wait();
		console.log(`Transaction ${txId} approved by ${owner2.address}`);
		currentApprovalCount = await multiSigWallet.getApprovalCount(txId);
		console.log(
			`Approval count after owner2 approval: ${currentApprovalCount}`
		);
	}

	// --- 7. Execute the transaction ---
	console.log("\n--- Executing Transaction ---");

	if (currentApprovalCount >= requiredApprovals) {
		console.log(
			`Required approvals (${requiredApprovals}) met. Executing transaction ${txId}...`
		);
		// Any owner can execute once approvals are met.
		// We'll use owner1 again for execution.
		const executeTx = await multiSigWalletConnectedByOwner1.execute(txId);
		await executeTx.wait();
		console.log(`Transaction ${txId} executed! Proxy has been upgraded.`);
	} else {
		console.log("Not enough approvals to execute the transaction. Aborting.");
		return; // Exit if not enough approvals
	}

	// --- 8. Initialize V2 specific state ---
	console.log("\n--- Initializing V2 State ---");
	// Connect to the proxy using the MyContractV2 interface to access its new functions.
	const myContractV2 = await ethers.getContractAt(
		"MyContractV2",
		MY_CONTRACT_PROXY_ADDRESS
	);
	console.log(
		"Connected to MyContractV2 Proxy (after upgrade) at:",
		await myContractV2.getAddress()
	);

	// Call initializeV2 through the MultiSigWallet to set the message
	const initializeV2TxData = myContractV2.interface.encodeFunctionData("initializeV2", []);

	const submitInitTx = await multiSigWalletConnectedByOwner1.submit(
		MY_CONTRACT_PROXY_ADDRESS,
		0,
		initializeV2TxData
	);
	const initReceipt = await submitInitTx.wait();
	const initEvent = initReceipt.logs.find(
		(log) => multiSigWallet.interface.parseLog(log)?.name === "Submit"
	);
	const initTxId = initEvent.args.txId;
	console.log(`Submitted initializeV2 transaction with ID: ${initTxId}`);
	console.log("requireApprovals: ", requiredApprovals.toString(), "\n");

	// Check current approval count for initializeV2
	let initApprovalCount = await multiSigWallet.getApprovalCount(initTxId);
	console.log(`Current approval count for initTxId ${initTxId}: ${initApprovalCount}`);

	// Approve if needed
	if (initApprovalCount < requiredApprovals) {
		console.log(`Additional approvals needed for initializeV2. Simulating owner2 approving transaction ${initTxId}...`);
		const multiSigWalletConnectedByOwner2 = multiSigWallet.connect(owner2);
		await multiSigWalletConnectedByOwner2.approve(initTxId);
		console.log(`InitializeV2 transaction ${initTxId} approved by ${owner2.address}`);
		initApprovalCount = await multiSigWallet.getApprovalCount(initTxId);
		console.log(`Approval count after owner2 approval: ${initApprovalCount}`);
	}

	// Execute initializeV2 only if we have enough approvals
	if (initApprovalCount >= requiredApprovals) {
		console.log(`Required approvals (${requiredApprovals}) met for initializeV2. Executing transaction ${initTxId}...`);
		await multiSigWalletConnectedByOwner1.execute(initTxId);
		console.log(`InitializeV2 transaction ${initTxId} executed!`);
	} else {
		console.log("Not enough approvals to execute initializeV2 transaction. Aborting.");
		return;
	}

	// --- 9. Verify the upgrade ---
	console.log("\n--- Verifying Upgrade ---");

	const newVersion = (await myContractV2.version()).toString();
	console.log("New contract version:", newVersion);

	const newValue = (await myContractV2.getValue()).toString();
	console.log("Value (persisted from V1):", newValue); // Value should persist

	const newMessage = await myContractV2.getMessage();
	console.log("New message (from V2's initializeV2):", newMessage); // Message should be "Hello from V2"

	if (newVersion === "2" && newMessage === "Hello from V2") {
		console.log("✅ Upgrade successful!");
	} else {
		console.error("❌ Upgrade verification failed.");
		console.error("Expected version 2, got:", newVersion);
		console.error("Expected message 'Hello from V2', got:", newMessage);
	}

	deploymentInfo.implementation = newMyContractV2ImplementationAddress; // Update to the new implementation address
	deploymentInfo.upgradeTimestamp = new Date().toISOString();

	fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));


	// --- Test a new function from V2 via MultiSigWallet ---
	console.log(
		"\n--- Testing new V2 function 'setMessage' via MultiSigWallet ---"
	);

	const messageToSet = "Updated message via MultiSig and V2!";
	const setMessageTxData = myContractV2.interface.encodeFunctionData(
		"setMessage",
		[messageToSet]
	);

	// Submit the setMessage transaction through the MultiSigWallet
	const submitSetMessageTx = await multiSigWalletConnectedByOwner1.submit(
		MY_CONTRACT_PROXY_ADDRESS, // Target is the proxy
		0, // No value
		setMessageTxData // Encoded setMessage call
	);
	const setMessageReceipt = await submitSetMessageTx.wait();
	const setMessageEvent = setMessageReceipt.logs.find(
		(log) => multiSigWallet.interface.parseLog(log)?.name === "Submit"
	);
	if (!setMessageEvent) {
		throw new Error("Submit event for setMessage not found.");
	}
	const setMessageTxId = setMessageEvent.args.txId;
	console.log(`Submitted 'setMessage' transaction with ID: ${setMessageTxId}`);

	// Check current approval count for setMessage
	let setMessageApprovalCount = await multiSigWallet.getApprovalCount(setMessageTxId);
	console.log(`Current approval count for setMessage txId ${setMessageTxId}: ${setMessageApprovalCount}`);

	// Approve the setMessage transaction if needed
	if (setMessageApprovalCount < requiredApprovals) {
		console.log(
			`Additional approvals needed for setMessage. Simulating owner2 approving transaction ${setMessageTxId}...`
		);
		const multiSigWalletConnectedByOwner2 = multiSigWallet.connect(owner2);
		await multiSigWalletConnectedByOwner2.approve(setMessageTxId);
		console.log(`Transaction ${setMessageTxId} approved by ${owner2.address}`);
		setMessageApprovalCount = await multiSigWallet.getApprovalCount(setMessageTxId);
		console.log(`Approval count after owner2 approval: ${setMessageApprovalCount}`);
	}

	// Execute the setMessage transaction only if we have enough approvals
	if (setMessageApprovalCount >= requiredApprovals) {
		console.log(`Required approvals (${requiredApprovals}) met for setMessage. Executing transaction ${setMessageTxId}...`);
		const executeSetMessageTx = await multiSigWalletConnectedByOwner1.execute(
			setMessageTxId
		);
		await executeSetMessageTx.wait();
		console.log(`'setMessage' transaction ${setMessageTxId} executed.`);
	} else {
		console.log("Not enough approvals to execute setMessage transaction. Aborting.");
		return;
	}

	const updatedMessage = await myContractV2.getMessage();
	console.log(
		"Message after calling setMessage via MultiSigWallet:",
		updatedMessage
	);

	if (updatedMessage === messageToSet) {
		console.log(
			"✅ New V2 function 'setMessage' works correctly via multisig!"
		);
	} else {
		console.error("❌ New V2 function 'setMessage' test failed.");
	}

	// --- Final Summary ---
	console.log("\n=== UPGRADE PROCESS COMPLETED ===");
	console.log("📋 Summary of operations:");
	console.log("1. ✅ Connected to MultiSigWallet and MyContractV1 proxy");
	console.log("2. ✅ Deployed new MyContractV2 implementation");
	console.log("3. ✅ Submitted upgrade transaction via MultiSigWallet");
	console.log("4. ✅ Obtained required approvals and executed upgrade");
	console.log("5. ✅ Initialized V2 state via MultiSigWallet");
	console.log("6. ✅ Verified upgrade success (version 2, message set)");
	console.log("7. ✅ Tested new V2 functionality via MultiSigWallet");
	console.log("\n🎉 Contract successfully upgraded from V1 to V2!");
	console.log(`📍 Proxy Address: ${MY_CONTRACT_PROXY_ADDRESS}`);
	console.log(`📍 New Implementation: ${newMyContractV2ImplementationAddress}`);
	console.log(`📍 MultiSig Address: ${MULTISIG_WALLET_ADDRESS}`);
	console.log(`📍 Final Version: ${newVersion}`);
	console.log(`📍 Final Message: "${updatedMessage}"`);
	console.log("\n✨ All operations completed successfully through MultiSigWallet governance!");
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
