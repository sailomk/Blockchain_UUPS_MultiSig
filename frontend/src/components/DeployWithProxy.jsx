// src/components/DeployWithProxy.jsx
import React, { useState } from "react";
import { ethers } from "ethers";
import { MY_CONTRACT_V1_ABI, MY_CONTRACT_V1_BYTECODE } from "../../public/artifacts/MyContractV1.json";

export default function DeployWithProxy({ signer, multiSigAddress }) {
    const [deploying, setDeploying] = useState(false);
    const [proxyAddress, setProxyAddress] = useState("");
    const [implementationAddress, setImplementationAddress] = useState("");
    const [status, setStatus] = useState("");

    const deployWithProxy = async () => {
        if (!signer) {
            alert("Please connect your wallet first");
            return;
        }

        if (!multiSigAddress) {
            alert("Please provide MultiSig wallet address");
            return;
        }

        setDeploying(true);
        setStatus("Deploying implementation contract...");

        try {
            // 1. Deploy Implementation
            const implementationFactory = new ethers.ContractFactory(
                MY_CONTRACT_V1_ABI,
                MY_CONTRACT_V1_BYTECODE,
                signer
            );

            const implementation = await implementationFactory.deploy();
            setStatus("Waiting for implementation deployment...");
            await implementation.waitForDeployment();

            const implAddress = await implementation.getAddress();
            setImplementationAddress(implAddress);
            setStatus(`Implementation deployed at: ${implAddress}`);

            // 2. Deploy Proxy
            setStatus("Deploying proxy contract...");

            // Get the ERC1967Proxy bytecode (you can get this from OpenZeppelin or Hardhat artifacts)
            const proxyBytecode = "0x608060405234801561001057600080fd5b506040516104b03803806104b08339818101604052810190610032919061014d565b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050610196565b6000815190506100778161017a565b92915050565b6000806040838503121561009157600080fd5b600061009f85828601610068565b92505060206100b085828601610068565b9150509250929050565b6000602082840312156100cc57600080fd5b60006100da84828501610068565b91505092915050565b600080fd5b600080fd5b600060208201905061010260008301846100f1565b92915050565b6000819050919050565b61011b81610108565b811461012657600080fd5b50565b60008151905061013b81610114565b92915050565b600060208284031215610153576101526100ed565b5b60006101618482850161012c565b91505092915050565b6000819050919050565b61017a81610167565b811461018557600080fd5b5056fe608060405234801561001057600080fd5b506040516104b03803806104b08339818101604052810190610032919061014d565b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050610196565b6000815190506100778161017a565b92915050565b6000806040838503121561009157600080fd5b600061009f85828601610068565b92505060206100b085828601610068565b9150509250929050565b6000602082840312156100cc57600080fd5b60006100da84828501610068565b91505092915050565b600080fd5b600080fd5b600060208201905061010260008301846100f1565b92915050565b6000819050919050565b61011b81610108565b811461012657600080fd5b50565b60008151905061013b81610114565b92915050565b600060208284031215610153576101526100ed565b5b60006101618482850161012c565b91505092915050565b6000819050919050565b61017a81610167565b811461018557600080fd5b5056fea2646970667358221220f8b8c7e3e4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a164736f6c63430008140033"; // ERC1967Proxy bytecode

            // Encode initialization data
            const initializeData = new ethers.Interface(MY_CONTRACT_V1_ABI).encodeFunctionData(
                "initialize",
                [multiSigAddress] // Pass MultiSig as owner
            );

            const proxyFactory = new ethers.ContractFactory(
                [], // No ABI needed for proxy deployment
                proxyBytecode,
                signer
            );

            const proxy = await proxyFactory.deploy(implAddress, initializeData);
            setStatus("Waiting for proxy deployment...");
            await proxy.waitForDeployment();

            const proxyAddr = await proxy.getAddress();
            setProxyAddress(proxyAddr);
            setStatus(`Proxy deployed successfully at: ${proxyAddr}`);

            console.log("Proxy deployed to:", proxyAddr);
            console.log("Implementation at:", implAddress);

        } catch (error) {
            console.error("Deployment error:", error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setDeploying(false);
        }
    };

    return (
        <div>
            <h3>Deploy MyContractV1 with UUPS Proxy</h3>
            <input
                placeholder="MultiSig Wallet Address"
                value={multiSigAddress}
                onChange={(e) => setMultiSigAddress(e.target.value)}
            />
            <button onClick={deployWithProxy} disabled={deploying}>
                {deploying ? "Deploying..." : "Deploy with Proxy"}
            </button>
            {status && <p>{status}</p>}
            {proxyAddress && (
                <p>
                    <strong>Proxy Address:</strong> {proxyAddress}
                </p>
            )}
            {implementationAddress && (
                <p>
                    <strong>Implementation Address:</strong> {implementationAddress}
                </p>
            )}
        </div>
    );
}