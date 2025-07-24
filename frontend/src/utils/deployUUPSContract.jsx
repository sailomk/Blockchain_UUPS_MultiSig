import { ethers } from 'ethers';

// Function to load contract artifacts
async function loadContractArtifact(contractName) {
    try {
        // First try to load from the artifacts directory
        const response = await fetch(`/artifacts/${contractName}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load artifact for ${contractName}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error loading ${contractName} artifact:`, error);
        throw error;
    }
}

// Function to deploy a UUPS upgradeable contract with MultiSigWallet
export async function deployUUPSContract(signer, initialValue = 0, useMultiSig = false, multiSigOwners = [], requiredApprovals = 1) {
    if (!signer) {
        throw new Error('No signer provided. Please connect your wallet.');
    }

    try {
        console.log("Loading contract artifacts...");

        // 1. Load contract artifacts
        const myContractArtifact = await loadContractArtifact("MyContractV1");
        console.log("MyContractV1 artifact loaded successfully");

        let multiSigWalletAddress = null;
        let ownerAddress = await signer.getAddress();

        // Deploy MultiSigWallet if requested
        if (useMultiSig) {
            console.log("Loading MultiSigWallet artifact...");
            const multiSigArtifact = await loadContractArtifact("MultiSigWallet");
            console.log("MultiSigWallet artifact loaded successfully");

            // Use provided owners or default to signer address
            const owners = multiSigOwners.length > 0 ? multiSigOwners : [ownerAddress];
            const required = Math.min(requiredApprovals, owners.length);

            console.log("MultiSigWallet owners:", owners);
            console.log("Required approvals for MultiSigWallet:", required);

            // Deploy MultiSigWallet
            const MultiSigWallet = new ethers.ContractFactory(
                multiSigArtifact.abi,
                multiSigArtifact.bytecode,
                signer
            );

            const multiSigWallet = await MultiSigWallet.deploy(owners, required);
            await multiSigWallet.waitForDeployment();
            multiSigWalletAddress = await multiSigWallet.getAddress();
            console.log("MultiSigWallet deployed to:", multiSigWalletAddress);

            // Use MultiSigWallet as the owner for the proxy
            ownerAddress = multiSigWalletAddress;
        }

        // 2. Deploy Implementation Contract (MyContractV1) - this will be the logic contract
        const MyContract = new ethers.ContractFactory(
            myContractArtifact.abi,
            myContractArtifact.bytecode,
            signer
        );

        const implementation = await MyContract.deploy();
        await implementation.waitForDeployment();

        const implementationAddress = await implementation.getAddress();
        console.log("Implementation deployed to:", implementationAddress);

        // 3. Create initialization data for the proxy
        // Based on MyContractV1.sol, initialize takes an owner address
        // Use either MultiSigWallet address or signer address as owner
        const initializeData = MyContract.interface.encodeFunctionData("initialize", [ownerAddress]);

        console.log(`Will set initial value to: ${initialValue}`);
        console.log(`Owner will be: ${ownerAddress}`);

        // 4. Deploy ERC1967Proxy for UUPS pattern
        // Use a reliable ERC1967Proxy implementation

        const erc1967ProxyArtifact = await loadContractArtifact("ERC1967Proxy");


        console.log("Deploying UUPS Proxy...");
        const ProxyFactory = new ethers.ContractFactory(
            erc1967ProxyArtifact.abi,
            erc1967ProxyArtifact.bytecode,
            signer
        );

        const proxy = await ProxyFactory.deploy(implementationAddress, initializeData);
        await proxy.waitForDeployment();

        const proxyAddress = await proxy.getAddress();
        console.log("UUPS Proxy deployed to:", proxyAddress);
        console.log("Implementation contract initialized successfully");

        // For UUPS, we can use the implementation address as the proxy address
        // since the upgrade logic is built into the contract itself
        proxyAddress = implementationAddress;
        console.log("UUPS Contract deployed to:", proxyAddress);



        // 5. Create a contract instance with the proxy address but using the implementation ABI
        const proxyAsImpl = new ethers.Contract(
            proxyAddress,
            myContractArtifact.abi,
            signer
        );

        // 6. Verify ownership
        const proxyOwner = await proxyAsImpl.owner();
        console.log("Owner of MyContractV1 Proxy:", proxyOwner);

        if (useMultiSig && proxyOwner === multiSigWalletAddress) {
            console.log("Successfully set MultiSigWallet as the owner of MyContractV1 Proxy!");
        } else if (!useMultiSig && proxyOwner === await signer.getAddress()) {
            console.log("Successfully set signer as the owner of MyContractV1 Proxy!");
        } else {
            console.log("Warning: Proxy owner verification failed.");
        }

        // 7. Set the initial value if it's not 0 and not using MultiSig (since MultiSig requires approval process)
        if (initialValue !== 0 && !useMultiSig) {
            console.log(`Setting initial value to: ${initialValue}`);
            const tx = await proxyAsImpl.setValue(initialValue);
            await tx.wait();
            console.log("Initial value set successfully");
        } else if (initialValue !== 0 && useMultiSig) {
            console.log(`Note: Initial value ${initialValue} cannot be set directly when using MultiSig. Use the MultiSig approval process.`);
        }

        // 8. Create deployment info object
        const deploymentInfo = {
            network: "localhost", // You might want to detect this dynamically
            multiSig: multiSigWalletAddress,
            proxy: proxyAddress,
            implementation: implementationAddress,
            owner: ownerAddress,
            initialValue: useMultiSig ? 0 : initialValue,
            timestamp: new Date().toISOString(),
        };

        // 9. Return the deployed addresses and contract instance
        return {
            proxyAddress,
            implementationAddress,
            multiSigWalletAddress,
            contract: proxyAsImpl,
            deploymentInfo
        };
    } catch (error) {
        console.error("Error deploying UUPS contract:", error);
        throw error;
    }
}
// Function to deploy UUPS contract with MultiSigWallet(similar to 1.deployV1.js)
export async function deployUUPSWithMultiSig(signer, multiSigOwners = [], requiredApprovals = 1) {
    if (!signer) {
        throw new Error('No signer provided. Please connect your wallet.');
    }

    // Use provided owners or default to first two accounts (for testing)
    const signerAddress = await signer.getAddress();
    const owners = multiSigOwners.length > 0 ? multiSigOwners : [signerAddress];
    const required = Math.min(requiredApprovals, owners.length);

    return await deployUUPSContract(signer, 0, true, owners, required);
}

// Function to save deployment info to localStorage (browser equivalent of fs.writeFileSync)
export function saveDeploymentInfo(deploymentInfo) {
    try {
        const existingDeployments = JSON.parse(localStorage.getItem('deployments') || '[]');
        existingDeployments.push(deploymentInfo);
        localStorage.setItem('deployments', JSON.stringify(existingDeployments));
        localStorage.setItem('latest-deployment', JSON.stringify(deploymentInfo));
        console.log('Deployment info saved to localStorage');
    } catch (error) {
        console.error('Error saving deployment info:', error);
    }
}

// Function to get latest deployment info
export function getLatestDeployment() {
    try {
        return JSON.parse(localStorage.getItem('latest-deployment'));
    } catch (error) {
        console.error('Error loading deployment info:', error);
        return null;
    }
}

// Function to get all deployments
export function getAllDeployments() {
    try {
        return JSON.parse(localStorage.getItem('deployments') || '[]');
    } catch (error) {
        console.error('Error loading deployments:', error);
        return [];
    }
}