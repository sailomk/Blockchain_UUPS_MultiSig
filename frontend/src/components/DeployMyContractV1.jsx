// src/components/DeployMyContractV1.jsx
import React, { useState } from "react";
import { ethers } from "ethers";
// Import directly from JSON file
import MyContractV1Artifact from "../artifacts/MyContractV1.json";
import MyContractV2Artifact from "../artifacts/MyContractV2.json";
import ERC1967 from "../artifacts/ERC1967Proxy.json";

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
    const [checking, setChecking] = useState(false);
    const [upgrading, setUpgrading] = useState(false);
    const [contractAddress, setContractAddress] = useState("");
    const [implementationAddress, setImplementationAddress] = useState("");
    const [v2ImplementationAddress, setV2ImplementationAddress] = useState("");
    const [ownerAddress, setOwnerAddress] = useState("");
    const [status, setStatus] = useState("");

    // 1. Deploy Implementation Contract
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

    // 2. Deploy Proxy Contract
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

    // 3. Check Contract After Deployment
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

    // 4. Upgrade to MyContractV2
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

            // If the current signer is not the owner, we need to use the owner address
            if (currentSignerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
                setStatus("⚠️ Current wallet is not the owner. The upgrade transaction must be sent by the owner address.");
                alert(`The upgrade must be performed by the owner (${ownerAddress}). Please switch to the owner wallet or ensure the owner performs this upgrade.`);
                return;
            }

            // Connect to the proxy contract using V1 ABI (since it's currently V1)
            const proxyContract = new ethers.Contract(contractAddress, MyContractV1Artifact.abi, upgradeSigner);

            // Call the upgrade function (assuming the contract has an upgradeTo function)
            // Note: This assumes the contract is using OpenZeppelin's UUPSUpgradeable pattern
            const upgradeTx = await proxyContract.upgradeTo(v2ImplAddress);
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
            const newFunctionResult = await safeContractCall(upgradedContract, 'getNewValue');

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
            if (error.message.includes('upgradeTo')) {
                setStatus(`❌ Upgrade failed: Contract may not support upgrades or you may not be the owner`);
            } else if (error.message.includes('Ownable')) {
                setStatus(`❌ Upgrade failed: Only the owner can upgrade this contract`);
            } else {
                setStatus(`❌ Upgrade error: ${error.message}`);
            }
        } finally {
            setUpgrading(false);
        }
    };

    return (
        <div>
            <h3>Deploy MyContractV1 with Proxy</h3>

            <div style={{ marginBottom: "20px" }}>
                <input
                    placeholder="Owner Address (e.g., MultiSig wallet)"
                    value={ownerAddress}
                    onChange={(e) => setOwnerAddress(e.target.value)}
                    style={{ width: "400px", padding: "8px", margin: "5px" }}
                />
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
                <button
                    onClick={deployImplementation}
                    disabled={deployingImplementation}
                    style={{ padding: "10px 15px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px" }}
                >
                    {deployingImplementation ? "Deploying..." : "1. Deploy Implementation"}
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
                    {deployingProxy ? "Deploying..." : "2. Deploy Proxy Contract"}
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
                    {checking ? "Checking..." : "3. Check Contract"}
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
                    {upgrading ? "Upgrading..." : "4. Upgrade to V2"}
                </button>
            </div>

            {status && <p style={{ padding: "10px", backgroundColor: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "5px" }}>{status}</p>}

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
        </div>
    );
}