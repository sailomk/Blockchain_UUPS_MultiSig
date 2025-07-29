// src/components/DeployMyContractV1.jsx
import React, { useState } from "react";
import { ethers } from "ethers";
// Import directly from JSON file
import MyContractV1Artifact from "../artifacts/MyContractV1.json";
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
    const [deploying, setDeploying] = useState(false);
    const [contractAddress, setContractAddress] = useState("");
    const [ownerAddress, setOwnerAddress] = useState("");
    const [status, setStatus] = useState("");

    const deployWithInitialization = async () => {
        if (!signer) {
            alert("Please connect your wallet first");
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

        setDeploying(true);
        setStatus("Deploying MyContractV1 implementation...");

        console.log("Singer ==>", signer);
        console.log("ownerAddress ==>", ownerAddress);

        try {
            // 1. Deploy Implementation Contract

            console.log("MyContractV1Artifact check:", {
                hasAbi: !!MyContractV1Artifact.abi,
                abiLength: MyContractV1Artifact.abi?.length,
                hasBytecode: !!MyContractV1Artifact.bytecode,
                bytecodeStart: MyContractV1Artifact.bytecode?.substring(0, 10)
            });

            const implementationFactory = new ethers.ContractFactory(
                MyContractV1Artifact.abi,      // ABI from JSON
                MyContractV1Artifact.bytecode, // Bytecode from JSON
                signer

            );
            //const price = ethers.utils.formatUnits(await provider.getGasPrice(), 'gwei')
            //const options = { gasLimit: 100000, gasPrice: ethers.utils.parseUnits(price, 'gwei') }

            const implementation = await implementationFactory.deploy();
            setStatus("Waiting for implementation deployment...");
            await implementation.waitForDeployment();

            const implAddress = await implementation.getAddress();
            setStatus(`Implementation deployed at: ${implAddress}`);
            console.log(`Implementation deployed at: ${implAddress}`);

            // 2. Deploy Proxy and Initialize
            setStatus("Deploying proxy and initializing...");

            // You'll need the ERC1967Proxy artifact too
            // For now, using a placeholder - you should get this from OpenZeppelin or Hardhat
            //const proxyBytecode = "0x608060405234801561001057600080fd5b506040516104b03803806104b08339818101604052810190610032919061014d565b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050610196565b6000815190506100778161017a565b92915050565b6000806040838503121561009157600080fd5b600061009f85828601610068565b92505060206100b085828601610068565b9150509250929050565b6000602082840312156100cc57600080fd5b60006100da84828501610068565b91505092915050565b600080fd5b600080fd5b600060208201905061010260008301846100f1565b92915050565b6000819050919050565b61011b81610108565b811461012657600080fd5b50565b60008151905061013b81610114565b92915050565b600060208284031215610153576101526100ed565b5b60006101618482850161012c565b91505092915050565b6000819050919050565b61017a81610167565b811461018557600080fd5b5056fea2646970667358221220f8b8c7e3e4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a164736f6c63430008140033";

            // Encode the initialize function call with the owner address
            const initializeData = new ethers.Interface(MyContractV1Artifact.abi).encodeFunctionData(
                "initialize",
                [ownerAddress]
            );


            // Deploy proxy with implementation and initialization data
            const proxyFactory = new ethers.ContractFactory(
                ERC1967.abi, // No ABI needed for proxy deployment
                ERC1967.bytecode,
                signer
            );

            const proxy = await proxyFactory.deploy(implAddress, initializeData);
            setStatus("Waiting for proxy deployment...");
            await proxy.waitForDeployment();

            const proxyAddr = await proxy.getAddress();
            setContractAddress(proxyAddr);
            setStatus(`Proxy deployed and initialized successfully at: ${proxyAddr}`);


            console.log("Proxy deployed to:", proxyAddr);
            console.log("Implementation at:", implAddress);
            console.log("Initialized with owner:", ownerAddress);

            // Test the deployed contract to make sure it works
            try {
                const deployedContract = new ethers.Contract(proxyAddr, MyContractV1Artifact.abi, signer);

                // Test available functions
                const valueResult = await safeContractCall(deployedContract, 'getValue');
                const ownerResult = await safeContractCall(deployedContract, 'owner');
                const versionResult = await safeContractCall(deployedContract, 'version');

                console.log("Contract test results:");
                console.log("- getValue():", valueResult);
                console.log("- owner():", ownerResult);
                console.log("- version():", versionResult);

                if (valueResult.success && ownerResult.success) {
                    setStatus(`✅ Deployment successful! Value: ${valueResult.result}, Owner: ${ownerResult.success ? ownerResult.result : 'Unknown'}, Version: ${versionResult.success ? versionResult.result : 'Unknown'}`);
                } else {
                    setStatus(`⚠️ Contract deployed but some functions failed to call`);
                }
            } catch (testError) {
                console.warn("Contract deployed but test failed:", testError);
                setStatus(`⚠️ Contract deployed but test failed: ${testError.message}`);
            }

        } catch (error) {
            console.error("Deployment error:", error);

            // Provide specific error messages
            if (error.message.includes('StackUnderflow')) {
                setStatus(`❌ StackUnderflow error: This usually means there's an issue with the contract bytecode or a function call to a non-existent function.`);
            } else if (error.message.includes('symbol')) {
                setStatus(`❌ Error: Something is trying to call symbol() function which doesn't exist in MyContractV1`);
            } else {
                setStatus(`❌ Error: ${error.message}`);
            }
        } finally {
            setDeploying(false);
        }
    };

    return (
        <div>
            <h3>Deploy MyContractV1 with Proxy</h3>
            <div>
                <input
                    placeholder="Owner Address (e.g., MultiSig wallet)"
                    value={ownerAddress}
                    onChange={(e) => setOwnerAddress(e.target.value)}
                    style={{ width: "400px", padding: "8px", margin: "5px" }}
                />
            </div>
            <button onClick={deployWithInitialization} disabled={deploying}>
                {deploying ? "Deploying..." : "Deploy & Initialize"}
            </button>
            {status && <p>{status}</p>}
            {contractAddress && (
                <div>
                    <p>
                        <strong>Proxy Contract Address:</strong> {contractAddress}
                    </p>
                    <p>
                        <strong>Owner Set To:</strong> {ownerAddress}
                    </p>
                </div>
            )}
        </div>
    );
}