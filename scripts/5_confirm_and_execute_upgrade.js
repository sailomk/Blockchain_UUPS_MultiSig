// scripts/confirm_and_execute_upgrade.js
const { ethers } = require("hardhat");

async function main() {
	// === CONFIGURATION ===
	const CUSTOM_MULTISIG_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // The address of your deployed SimpleMultisig
	const TX_ID_TO_CONFIRM = 0; // The ID of the upgrade transaction proposed in the previous step (e.g., 0)
	// === END CONFIGURATION ===

	const [deployer, owner1, owner2, owner3] = await ethers.getSigners();

	const SimpleMultisig = await ethers.getContractFactory("SimpleMultisig");

	// --- OWNER 1 Confirms ---
	console.log(
		`Owner 1 (${owner1.address}) confirming transaction ${TX_ID_TO_CONFIRM}...`
	);
	const multisigOwner1 = SimpleMultisig.attach(CUSTOM_MULTISIG_ADDRESS).connect(
		owner1
	);
	const confirmTx1 = await multisigOwner1.confirmTransaction(TX_ID_TO_CONFIRM);
	console.log("Transaction Receipt:", await confirmTx1.wait());
	//await confirmTx1.wait();
	console.log("Owner 1 confirmed.");

	let txInfo = await multisigOwner1.getTransaction(TX_ID_TO_CONFIRM);
	console.log(
		`Current confirmations for Tx ${TX_ID_TO_CONFIRM}: ${txInfo.numConfirmations.toString()}`
	);
	console.log(
		`Required confirmations: ${(
			await multisigOwner1.numConfirmationsRequired()
		).toString()}`
	);

	// --- OWNER 2 Confirms (if required) ---
	// Change this to owner2, owner3, etc., depending on your multisig setup
	if (
		txInfo.numConfirmations < (await multisigOwner1.numConfirmationsRequired())
	) {
		console.log(
			`Owner 2 (${owner2.address}) confirming transaction ${TX_ID_TO_CONFIRM}...`
		);
		const gasLimit = 6_000_000;
		const multisigOwner2 = SimpleMultisig.attach(
			CUSTOM_MULTISIG_ADDRESS
		).connect(owner2);
		const confirmTx2 = await multisigOwner2.confirmTransaction(
			TX_ID_TO_CONFIRM,
			{ gasLimit: gasLimit }
		);
		//await confirmTx2.wait();
		console.log("Transaction Receipt:", await confirmTx2.wait());
		console.log("Owner 2 confirmed.");

		txInfo = await multisigOwner1.getTransaction(TX_ID_TO_CONFIRM);
		console.log(
			`Current confirmations for Tx ${TX_ID_TO_CONFIRM}: ${txInfo.numConfirmations.toString()}`
		);
	}

	// --- Execute Transaction (by any owner after threshold is met) ---
	// If auto-execution is not enabled, or if it failed for some reason, an owner can call execute explicitly.
	// The `confirmTransaction` function in `SimpleMultisig` includes auto-execution.
	// So, this block is mostly for demonstration if auto-execute wasn't there or failed.

	if (
		txInfo.numConfirmations >=
			(await multisigOwner1.numConfirmationsRequired()) &&
		!txInfo.executed
	) {
		console.log(
			`Executing transaction ${TX_ID_TO_CONFIRM} with account ${owner1.address}...`
		);
		const gasLimit = 6_000_000;
		const executeTx = await multisigOwner1.executeTransaction(
			TX_ID_TO_CONFIRM,
			{ gasLimit: gasLimit }
		);
		console.log("executeTx Receipt:", await executeTx.wait());
		//await executeTx.wait();
		console.log(`Transaction ${TX_ID_TO_CONFIRM} executed successfully!`);
	} else if (txInfo.executed) {
		console.log(`Transaction ${TX_ID_TO_CONFIRM} was already executed.`);
	} else {
		console.log(
			`Not enough confirmations yet for transaction ${TX_ID_TO_CONFIRM}.`
		);
	}

	// --- Verify UUPS Proxy is now V2 ---
	const MyContractV2 = await ethers.getContractFactory("MyContractV2");
	const myContractProxyV2 = MyContractV2.attach(txInfo.to); // Attach to the proxy address from the transaction info
	const contractVersion = await myContractProxyV2.version();
	console.log(
		"MyContract (proxy) version after upgrade:",
		contractVersion.toString()
	);

	const newMessage = await myContractProxyV2.getMessage();
	console.log("MyContract (proxy) new message from V2:", newMessage);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
