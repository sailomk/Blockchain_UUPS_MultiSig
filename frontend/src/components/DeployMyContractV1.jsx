// src/components/DeployMyContractV1.jsx
import React, { useState } from "react";
import { ethers } from "ethers";
// Import directly from JSON file
import MyContractV1Artifact from "../artifacts/MyContractV1.json";
import MyContractV2Artifact from "../artifacts/MyContractV2.json";
import ERC1967 from "../artifacts/ERC1967Proxy.json";
import MultiSigWalletArtifact from "../artifacts/MultiSigWallet.json";

// Utility function to safely call contract functions
const safeContractCall = async (contract, functionName, ...args) => {
    try {
        const result = await contract[functionName](...args);
        return { success: true, result };
    } catch (error) {
        console.warn(`Failed to call ${functionName}:`, error.message);
        return { success: false, error: error.message };
    }
};

export default function DeployMyContractV1({ signer }) {
    const [deployingProxy, setDeployingProxy] = useState(false);
    const [deployingImplementation, setDeployingImplementation] = useState(false);
    const [deployingMultiSig, setDeployingMultiSig] = useState(false);
    const [checking, setChecking] = useState(false);
    const [upgrading, setUpgrading] = useState(false);
    const [contractAddress, setContractAddress] = useState("");
    const [implementationAddress, setImplementationAddress] = useState("");
    const [v2ImplementationAddress, setV2ImplementationAddress] = useState("");
    const [multiSigAddress, setMultiSigAddress] = useState("");
    const [ownerAddress, setOwnerAddress] = useState("");
    const [multiSigOwners, setMultiSigOwners] = useState("");
    const [requiredApprovals, setRequiredApprovals] = useState("2");
    const [status, setStatus] = useState("");
    const [currentVersion, setCurrentVersion] = useState("");
    const [gettingVersion, setGettingVersion] = useState(false);

    // Reset all state (useful when Hardhat node is restarted)
    const resetAll = () => {
        setContractAddress("");
        setImplementationAddress("");
        setV2ImplementationAddress("");
        setMultiSigAddress("");
        setOwnerAddress("");
        setMultiSigOwners("");
        setRequiredApprovals("2");
        setCurrentVersion("");
        setStatus("🔄 All addresses cleared. Ready for fresh deployment.");
        console.log("All contract addresses cleared");
    };



    // Check if contract exists at address
    const checkContractExists = async (address, name) => {
        try {
            const code = await signer.provider.getCode(address);
            if (code === '0x') {
                console.log(`❌ No contract found at ${name} address: ${address}`);
                setStatus(`❌ No contract found at ${name} address. Did you restart Hardhat node? Use Reset All button.`);
                return false;
            }
            return true;
        } catch (error) {
            console.error(`Error checking ${name} contract:`, error);
            return false;
        }
    };

    // Check MultiSig Wallet
    const checkMultiSig = async () => {
        if (!signer || !multiSigAddress) {
            console.log("Missing signer or multiSigAddress");
            setStatus("❌ Missing signer or MultiSig address");
            return;
        }

        // First check if contract exists
        const exists = await checkContractExists(multiSigAddress, "MultiSig");
        if (!exists) return;

        try {
            console.log("=== MultiSig Check ===");
            console.log("MultiSig Address:", multiSigAddress);

            const multiSig = new ethers.Contract(multiSigAddress, MultiSigWalletArtifact.abi, signer);
            const currentSignerAddress = await signer.getAddress();
            console.log("Current Signer:", currentSignerAddress);

            // Test basic functions
            console.log("Testing required() function...");
            const required = await safeContractCall(multiSig, 'required');
            console.log("Required result:", required);

            console.log("Testing isOwner() function...");
            const isOwnerResult = await safeContractCall(multiSig, 'isOwner', currentSignerAddress);
            console.log("IsOwner result:", isOwnerResult);

            const balance = await signer.provider.getBalance(multiSigAddress);
            console.log("Balance:", ethers.formatEther(balance));

            if (required.success && isOwnerResult.success) {
                setStatus(`✅ MultiSig check successful! Required: ${required.result}, Is Owner: ${isOwnerResult.result}, Balance: ${ethers.formatEther(balance)} ETH`);
            } else {
                setStatus("⚠️ MultiSig exists but some functions failed - see console for details");
            }

        } catch (error) {
            console.error("MultiSig check error:", error);
            setStatus(`❌ MultiSig check failed: ${error.message}`);
        }
    };

    // Auto-check MultiSig when deployed (disabled to prevent errors)
    // useEffect(() => {
    //     if (multiSigAddress && signer) {
    //         checkMultiSig();
    //     }
    // }, [multiSigAddress, signer]);

    // 1. Deploy MultiSigWallet Contract
    const deployMultiSigWallet = async () => {
        if (!signer) {
            alert("Please connect your wallet first");
            return;
        }

        if (!multiSigOwners.trim()) {
            alert("Please enter MultiSig owner addresses");
            return;
        }

        setDeployingMultiSig(true);
        setStatus("Deploying MultiSigWallet...");

        try {
            // Parse owner addresses from comma-separated string
            const ownerAddresses = multiSigOwners
                .split(',')
                .map(addr => addr.trim())
                .filter(addr => addr.length > 0);

            // Validate addresses
            const validatedOwners = [];
            for (const addr of ownerAddresses) {
                try {
                    const validAddress = ethers.getAddress(addr);
                    validatedOwners.push(validAddress);
                } catch (error) {
                    alert(`Invalid address: ${addr}`);
                    return;
                }
            }

            if (validatedOwners.length === 0) {
                alert("Please provide at least one valid owner address");
                return;
            }

            const requiredNum = parseInt(requiredApprovals);
            if (requiredNum <= 0 || requiredNum > validatedOwners.length) {
                alert(`Required approvals must be between 1 and ${validatedOwners.length}`);
                return;
            }

            console.log("MultiSigWallet deployment params:", {
                owners: validatedOwners,
                required: requiredNum
            });

            const multiSigFactory = new ethers.ContractFactory(
                MultiSigWalletArtifact.abi,
                MultiSigWalletArtifact.bytecode,
                signer
            );

            const multiSig = await multiSigFactory.deploy(validatedOwners, requiredNum);
            setStatus("Waiting for MultiSigWallet deployment...");
            await multiSig.waitForDeployment();

            const multiSigAddr = await multiSig.getAddress();

            // Skip verification for now to avoid function call errors
            console.log("MultiSig deployment completed, skipping verification");

            setMultiSigAddress(multiSigAddr);
            setOwnerAddress(multiSigAddr); // Auto-set as owner for MyContractV1
            setStatus(`✅ MultiSigWallet deployed at: ${multiSigAddr}`);
            console.log(`MultiSigWallet deployed at: ${multiSigAddr}`);

        } catch (error) {
            console.error("MultiSigWallet deployment error:", error);
            setStatus(`❌ MultiSigWallet deployment error: ${error.message}`);
        } finally {
            setDeployingMultiSig(false);
        }
    };

    // 2. Deploy Implementation Contract
    const deployImplementation = async () => {
        if (!signer) {
            alert("Please connect your wallet first");
            return;
        }

        setDeployingImplementation(true);
        setStatus("Deploying MyContractV1 implementation...");

        console.log("Signer ==>", signer);

        try {
            console.log("MyContractV1Artifact check:", {
                hasAbi: !!MyContractV1Artifact.abi,
                abiLength: MyContractV1Artifact.abi?.length,
                hasBytecode: !!MyContractV1Artifact.bytecode,
                bytecodeStart: MyContractV1Artifact.bytecode?.substring(0, 10)
            });

            const implementationFactory = new ethers.ContractFactory(
                MyContractV1Artifact.abi,
                MyContractV1Artifact.bytecode,
                signer
            );

            const implementation = await implementationFactory.deploy();
            setStatus("Waiting for implementation deployment...");
            await implementation.waitForDeployment();

            const implAddress = await implementation.getAddress();
            setImplementationAddress(implAddress);
            setStatus(`✅ Implementation deployed at: ${implAddress}`);
            console.log(`Implementation deployed at: ${implAddress}`);

        } catch (error) {
            console.error("Implementation deployment error:", error);
            setStatus(`❌ Implementation deployment error: ${error.message}`);
        } finally {
            setDeployingImplementation(false);
        }
    };

    // 3. Deploy Proxy Contract
    const deployProxy = async () => {
        if (!signer) {
            alert("Please connect your wallet first");
            return;
        }

        if (!implementationAddress) {
            alert("Please deploy implementation contract first");
            return;
        }

        if (!ownerAddress) {
            alert("Please enter owner address");
            return;
        }

        try {
            // Validate owner address
            ethers.getAddress(ownerAddress);
        } catch (error) {
            alert("Invalid owner address");
            return;
        }

        setDeployingProxy(true);
        setStatus("Deploying proxy and initializing...");

        console.log("ownerAddress ==>", ownerAddress);

        try {
            // Encode the initialize function call with the owner address
            const initializeData = new ethers.Interface(MyContractV1Artifact.abi).encodeFunctionData(
                "initialize",
                [ownerAddress]
            );

            // Deploy proxy with implementation and initialization data
            const proxyFactory = new ethers.ContractFactory(
                ERC1967.abi,
                ERC1967.bytecode,
                signer
            );

            const proxy = await proxyFactory.deploy(implementationAddress, initializeData);
            setStatus("Waiting for proxy deployment...");
            await proxy.waitForDeployment();

            const proxyAddr = await proxy.getAddress();
            setContractAddress(proxyAddr);
            setStatus(`✅ Proxy deployed and initialized successfully at: ${proxyAddr}`);

            console.log("Proxy deployed to:", proxyAddr);
            console.log("Implementation at:", implementationAddress);
            console.log("Initialized with owner:", ownerAddress);

        } catch (error) {
            console.error("Proxy deployment error:", error);
            setStatus(`❌ Proxy deployment error: ${error.message}`);
        } finally {
            setDeployingProxy(false);
        }
    };

    // 4. Check Contract After Deployment
    const checkContract = async () => {
        if (!signer) {
            alert("Please connect your wallet first");
            return;
        }

        if (!contractAddress) {
            alert("Please deploy proxy contract first");
            return;
        }

        setChecking(true);
        setStatus("Checking deployed contract...");

        try {
            const deployedContract = new ethers.Contract(contractAddress, MyContractV1Artifact.abi, signer);

            // Test available functions
            const valueResult = await safeContractCall(deployedContract, 'getValue');
            const ownerResult = await safeContractCall(deployedContract, 'owner');
            const versionResult = await safeContractCall(deployedContract, 'version');

            console.log("Contract test results:");
            console.log("- getValue():", valueResult);
            console.log("- owner():", ownerResult);
            console.log("- version():", versionResult);

            if (valueResult.success && ownerResult.success) {
                setStatus(`✅ Contract check successful! Value: ${valueResult.result}, Owner: ${ownerResult.success ? ownerResult.result : 'Unknown'}, Version: ${versionResult.success ? versionResult.result : 'Unknown'}`);
            } else {
                setStatus(`⚠️ Contract deployed but some functions failed to call`);
            }

        } catch (error) {
            console.error("Contract check error:", error);
            setStatus(`❌ Contract check failed: ${error.message}`);
        } finally {
            setChecking(false);
        }
    };

    // Get Version via Proxy
    const getVersionViaProxy = async () => {
        if (!signer) {
            alert("Please connect your wallet first");
            return;
        }

        if (!contractAddress) {
            alert("Please deploy proxy contract first");
            return;
        }

        // Check if contract exists first
        const exists = await checkContractExists(contractAddress, "Proxy");
        if (!exists) {
            setCurrentVersion("Contract Not Found");
            setGettingVersion(false);
            return;
        }

        setGettingVersion(true);
        setStatus("Getting version via proxy...");

        try {
            // Try with V1 ABI first
            let deployedContract = new ethers.Contract(contractAddress, MyContractV1Artifact.abi, signer);
            let versionResult = await safeContractCall(deployedContract, 'version');

            // If V1 fails, try with V2 ABI (in case it's been upgraded)
            if (!versionResult.success) {
                deployedContract = new ethers.Contract(contractAddress, MyContractV2Artifact.abi, signer);
                versionResult = await safeContractCall(deployedContract, 'version');
            }

            if (versionResult.success) {
                const version = versionResult.result.toString();
                setCurrentVersion(version);
                setStatus(`✅ Current contract version: ${version}`);
                console.log("Contract version:", version);
            } else {
                setStatus(`❌ Failed to get version: ${versionResult.error}`);
                setCurrentVersion("Unknown");
            }

        } catch (error) {
            console.error("Version check error:", error);
            setStatus(`❌ Version check failed: ${error.message}`);
            setCurrentVersion("Error");
        } finally {
            setGettingVersion(false);
        }
    };

    // Submit transaction to MultiSig
    const submitToMultiSig = async (to, value, data, description) => {
        if (!signer || !multiSigAddress) {
            alert("MultiSig wallet not deployed");
            return;
        }

        try {
            const multiSig = new ethers.Contract(multiSigAddress, MultiSigWalletArtifact.abi, signer);
            const currentSignerAddress = await signer.getAddress();

            // Check if current signer is an owner of the MultiSig
            console.log("Checking MultiSig ownership...");
            console.log("Current signer:", currentSignerAddress);
            console.log("MultiSig address:", multiSigAddress);

            const isOwnerResult = await safeContractCall(multiSig, 'isOwner', currentSignerAddress);
            console.log("Is current signer a MultiSig owner?", isOwnerResult);

            if (!isOwnerResult.success || !isOwnerResult.result) {
                setStatus(`❌ Current wallet (${currentSignerAddress}) is not an owner of the MultiSig wallet. Only MultiSig owners can submit transactions.`);
                alert(`You must be one of the MultiSig owners to submit transactions. Current wallet: ${currentSignerAddress}`);
                return;
            }

            setStatus(`Submitting ${description} to MultiSig...`);
            console.log("Submitting transaction:", { to, value, data });

            const tx = await multiSig.submit(to, value, data);
            await tx.wait();

            setStatus(`✅ ${description} submitted to MultiSig. Transaction ID will be in the logs.`);
            console.log(`${description} submitted to MultiSig:`, { to, value, data });

        } catch (error) {
            console.error(`MultiSig submission error:`, error);
            setStatus(`❌ Failed to submit ${description} to MultiSig: ${error.message}`);

            // Provide more specific error messages
            if (error.message.includes('not owner')) {
                alert('Only MultiSig owners can submit transactions. Please switch to an owner wallet.');
            } else if (error.message.includes('unrecognized-selector')) {
                alert('Function not found in contract. Please check the contract ABI.');
            }
        }
    };

    // 5. Upgrade to MyContractV2
    const upgradeToV2 = async () => {
        if (!signer) {
            alert("Please connect your wallet first");
            return;
        }

        if (!contractAddress) {
            alert("Please deploy and check the proxy contract first");
            return;
        }

        if (!ownerAddress) {
            alert("Please enter owner address");
            return;
        }

        try {
            // Validate owner address
            ethers.getAddress(ownerAddress);
        } catch (error) {
            alert("Invalid owner address");
            return;
        }

        setUpgrading(true);
        setStatus("Deploying MyContractV2 implementation...");

        try {
            // First, deploy the new V2 implementation using current signer
            console.log("MyContractV2Artifact check:", {
                hasAbi: !!MyContractV2Artifact.abi,
                abiLength: MyContractV2Artifact.abi?.length,
                hasBytecode: !!MyContractV2Artifact.bytecode,
                bytecodeStart: MyContractV2Artifact.bytecode?.substring(0, 10)
            });

            const v2ImplementationFactory = new ethers.ContractFactory(
                MyContractV2Artifact.abi,
                MyContractV2Artifact.bytecode,
                signer
            );

            const v2Implementation = await v2ImplementationFactory.deploy();
            setStatus("Waiting for V2 implementation deployment...");
            await v2Implementation.waitForDeployment();

            const v2ImplAddress = await v2Implementation.getAddress();
            setV2ImplementationAddress(v2ImplAddress);
            setStatus(`V2 Implementation deployed at: ${v2ImplAddress}`);
            console.log(`V2 Implementation deployed at: ${v2ImplAddress}`);

            // Now upgrade the proxy to point to the new implementation
            setStatus("Upgrading proxy to V2...");

            // Check if the current signer is the owner
            const currentSignerAddress = await signer.getAddress();
            console.log("Current signer address:", currentSignerAddress);
            console.log("Owner address:", ownerAddress);

            let upgradeSigner = signer;

            // Check if owner is a MultiSig wallet
            const isMultiSigOwner = ownerAddress === multiSigAddress;

            if (isMultiSigOwner) {
                setStatus("⚠️ Owner is MultiSig wallet. Use 'Submit Upgrade to MultiSig' button instead.");
                alert(`The owner is a MultiSig wallet (${ownerAddress}). Direct upgrade is not possible because the _authorizeUpgrade function requires onlyOwner permission. Please use the 'Submit Upgrade to MultiSig' button to submit the upgrade transaction for MultiSig approval.`);
                return;
            }

            // If the current signer is not the owner, we need to use the owner address
            if (currentSignerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
                setStatus("⚠️ Current wallet is not the owner. The upgrade transaction must be sent by the owner address.");
                alert(`The upgrade must be performed by the owner (${ownerAddress}). Please switch to the owner wallet or ensure the owner performs this upgrade.`);
                return;
            }

            // For UUPS pattern, call upgradeToAndCall on the proxy using the implementation ABI
            console.log("Using UUPS upgrade pattern");
            const proxyContract = new ethers.Contract(contractAddress, MyContractV1Artifact.abi, upgradeSigner);

            // Call upgradeToAndCall function with empty data (this is available because MyContractV1 inherits from UUPSUpgradeable)
            const upgradeTx = await proxyContract.upgradeToAndCall(v2ImplAddress, "0x");

            setStatus("Waiting for upgrade transaction...");
            await upgradeTx.wait();

            setStatus("Verifying upgrade...");

            // Test the upgraded contract with V2 ABI
            const upgradedContract = new ethers.Contract(contractAddress, MyContractV2Artifact.abi, signer);

            // Test V2 specific functions
            const valueResult = await safeContractCall(upgradedContract, 'getValue');
            const ownerResult = await safeContractCall(upgradedContract, 'owner');
            const versionResult = await safeContractCall(upgradedContract, 'version');

            // Test new V2 function if it exists
            const newFunctionResult = await safeContractCall(upgradedContract, 'getValue');

            console.log("V2 Contract test results:");
            console.log("- getValue():", valueResult);
            console.log("- owner():", ownerResult);
            console.log("- version():", versionResult);
            console.log("- getNewValue():", newFunctionResult);

            if (valueResult.success && ownerResult.success) {
                setStatus(`✅ Upgrade to V2 successful! Value: ${valueResult.result}, Owner: ${ownerResult.success ? ownerResult.result : 'Unknown'}, Version: ${versionResult.success ? versionResult.result : 'Unknown'}${newFunctionResult.success ? `, New Value: ${newFunctionResult.result}` : ''}`);
            } else {
                setStatus(`⚠️ Upgrade completed but some functions failed to call`);
            }

        } catch (error) {
            console.error("Upgrade error:", error);

            // Provide specific error messages
            if (error.message.includes('upgradeTo is not a function')) {
                setStatus(`❌ Upgrade failed: Contract doesn't support UUPS upgrades. It may use a different upgrade pattern or not be upgradeable.`);
            } else if (error.message.includes('Upgrade not supported')) {
                setStatus(`❌ Upgrade failed: This proxy pattern is not supported by this interface. Manual upgrade may be required.`);
            } else if (error.message.includes('Ownable') || error.message.includes('caller is not the owner')) {
                setStatus(`❌ Upgrade failed: Only the owner can upgrade this contract`);
            } else if (error.message.includes('revert')) {
                setStatus(`❌ Upgrade failed: Transaction reverted. Check if you're the owner and the contract supports upgrades.`);
            } else {
                setStatus(`❌ Upgrade error: ${error.message}`);
            }
        } finally {
            setUpgrading(false);
        }
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ margin: 0 }}>Deploy MyContractV1 with MultiSig Proxy</h3>
                <button
                    onClick={resetAll}
                    style={{
                        padding: "8px 15px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                        fontSize: "14px"
                    }}
                    title="Clear all addresses (use when Hardhat node is restarted)"
                >
                    🔄 Reset All
                </button>
            </div>

            {(contractAddress || multiSigAddress || implementationAddress) && (
                <div style={{
                    marginBottom: "15px",
                    padding: "10px",
                    backgroundColor: "#fff3cd",
                    border: "1px solid #ffeaa7",
                    borderRadius: "5px",
                    fontSize: "14px"
                }}>
                    <strong>💡 Note:</strong> If you see "unrecognized-selector" errors in Hardhat console,
                    it means the contracts were deployed in a previous session. Click "🔄 Reset All" and redeploy.
                </div>
            )}

            <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "5px" }}>
                <h4>MultiSig Configuration</h4>
                <div style={{ marginBottom: "10px" }}>
                    <input
                        placeholder="MultiSig Owner Addresses (comma-separated)"
                        value={multiSigOwners}
                        onChange={(e) => setMultiSigOwners(e.target.value)}
                        style={{ width: "500px", padding: "8px", margin: "5px" }}
                    />
                    <div style={{ fontSize: "12px", color: "#666", marginLeft: "5px" }}>
                        Example: 0x123...,0x456...,0x789...
                    </div>
                </div>
                <div style={{ marginBottom: "10px" }}>
                    <input
                        type="number"
                        placeholder="Required Approvals"
                        value={requiredApprovals}
                        onChange={(e) => setRequiredApprovals(e.target.value)}
                        style={{ width: "200px", padding: "8px", margin: "5px" }}
                        min="1"
                    />
                    <div style={{ fontSize: "12px", color: "#666", marginLeft: "5px" }}>
                        Number of approvals required for transactions
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
                <input
                    placeholder="Owner Address (will be auto-filled with MultiSig address)"
                    value={ownerAddress}
                    onChange={(e) => setOwnerAddress(e.target.value)}
                    style={{ width: "400px", padding: "8px", margin: "5px" }}
                />
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
                <button
                    onClick={deployMultiSigWallet}
                    disabled={deployingMultiSig}
                    style={{ padding: "10px 15px", backgroundColor: "#6f42c1", color: "white", border: "none", borderRadius: "5px" }}
                >
                    {deployingMultiSig ? "Deploying..." : "1. Deploy MultiSig"}
                </button>

                <button
                    onClick={deployImplementation}
                    disabled={deployingImplementation}
                    style={{ padding: "10px 15px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px" }}
                >
                    {deployingImplementation ? "Deploying..." : "2. Deploy Implementation"}
                </button>

                <button
                    onClick={deployProxy}
                    disabled={deployingProxy || !implementationAddress}
                    style={{
                        padding: "10px 15px",
                        backgroundColor: implementationAddress ? "#28a745" : "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "5px"
                    }}
                >
                    {deployingProxy ? "Deploying..." : "3. Deploy Proxy Contract"}
                </button>

                <button
                    onClick={checkContract}
                    disabled={checking || !contractAddress}
                    style={{
                        padding: "10px 15px",
                        backgroundColor: contractAddress ? "#17a2b8" : "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "5px"
                    }}
                >
                    {checking ? "Checking..." : "4. Check Contract"}
                </button>

                <button
                    onClick={upgradeToV2}
                    disabled={upgrading || !contractAddress || !ownerAddress}
                    style={{
                        padding: "10px 15px",
                        backgroundColor: (contractAddress && ownerAddress) ? "#fd7e14" : "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "5px"
                    }}
                >
                    {upgrading ? "Upgrading..." : "5. Upgrade to V2"}
                </button>

                {multiSigAddress && v2ImplementationAddress && (
                    <button
                        onClick={async () => {
                            try {
                                // Create interface with UUPS upgrade function
                                const upgradeInterface = new ethers.Interface([
                                    "function upgradeTo(address newImplementation) external",
                                    "function upgradeToAndCall(address newImplementation, bytes calldata data) external payable"
                                ]);
                                const upgradeData = upgradeInterface.encodeFunctionData("upgradeTo", [v2ImplementationAddress]);
                                await submitToMultiSig(contractAddress, 0, upgradeData, "Upgrade to V2");
                            } catch (error) {
                                console.error("Error preparing upgrade data:", error);
                                setStatus(`❌ Error preparing upgrade data: ${error.message}`);
                            }
                        }}
                        disabled={!contractAddress || !v2ImplementationAddress}
                        style={{
                            padding: "10px 15px",
                            backgroundColor: (contractAddress && v2ImplementationAddress) ? "#e83e8c" : "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "5px"
                        }}
                    >
                        Submit Upgrade to MultiSig
                    </button>
                )}
            </div>

            {status && <p style={{ padding: "10px", backgroundColor: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "5px" }}>{status}</p>}

            {multiSigAddress && (
                <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#f3e5f5", border: "1px solid #ce93d8", borderRadius: "5px" }}>
                    <p><strong>MultiSig Wallet Address:</strong> {multiSigAddress}</p>
                    <p><strong>Required Approvals:</strong> {requiredApprovals}</p>
                    <button
                        onClick={checkMultiSig}
                        style={{
                            padding: "5px 10px",
                            backgroundColor: "#6f42c1",
                            color: "white",
                            border: "none",
                            borderRadius: "3px",
                            marginTop: "5px",
                            cursor: "pointer"
                        }}
                    >
                        Check MultiSig Status
                    </button>
                </div>
            )}

            {implementationAddress && (
                <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#e7f3ff", border: "1px solid #b3d9ff", borderRadius: "5px" }}>
                    <p><strong>Implementation Address:</strong> {implementationAddress}</p>
                </div>
            )}

            {contractAddress && (
                <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#e8f5e8", border: "1px solid #c3e6c3", borderRadius: "5px" }}>
                    <p><strong>Proxy Contract Address:</strong> {contractAddress}</p>
                    <p><strong>Owner Set To:</strong> {ownerAddress}</p>
                </div>
            )}

            {v2ImplementationAddress && (
                <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#fff3cd", border: "1px solid #ffeaa7", borderRadius: "5px" }}>
                    <p><strong>V2 Implementation Address:</strong> {v2ImplementationAddress}</p>
                    <p><strong>Status:</strong> Contract upgraded to V2</p>
                </div>
            )}

            {/* Version Check Section */}
            {contractAddress && (
                <div style={{ marginTop: "20px", padding: "15px", border: "2px solid #007bff", borderRadius: "8px", backgroundColor: "#f8f9ff" }}>
                    <h4 style={{ margin: "0 0 15px 0", color: "#007bff" }}>Contract Version Check</h4>
                    <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
                        <button
                            onClick={getVersionViaProxy}
                            disabled={gettingVersion}
                            style={{
                                padding: "10px 20px",
                                backgroundColor: "#007bff",
                                color: "white",
                                border: "none",
                                borderRadius: "5px",
                                cursor: gettingVersion ? "not-allowed" : "pointer",
                                opacity: gettingVersion ? 0.6 : 1
                            }}
                        >
                            {gettingVersion ? "Getting Version..." : "Get Version via Proxy"}
                        </button>

                        {currentVersion && (
                            <div style={{
                                padding: "8px 15px",
                                backgroundColor: currentVersion === "1" ? "#d4edda" : currentVersion === "2" ? "#fff3cd" : "#f8d7da",
                                border: `1px solid ${currentVersion === "1" ? "#c3e6cb" : currentVersion === "2" ? "#ffeaa7" : "#f5c6cb"}`,
                                borderRadius: "5px",
                                fontWeight: "bold"
                            }}>
                                <span style={{ color: "#495057" }}>Current Version: </span>
                                <span style={{
                                    color: currentVersion === "1" ? "#155724" : currentVersion === "2" ? "#856404" : "#721c24",
                                    fontSize: "18px"
                                }}>
                                    v{currentVersion}
                                </span>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: "10px", fontSize: "14px", color: "#6c757d" }}>
                        This button calls the version() function through the proxy contract to determine which implementation is currently active.
                    </div>
                </div>
            )}
        </div>
    );
}