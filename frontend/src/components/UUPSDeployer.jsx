import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { deployUUPSContract, deployUUPSWithMultiSig, saveDeploymentInfo } from '../utils/deployUUPSContract';
import './UUPSDeployer.css';

export default function UUPSDeployer() {
    const [proxyAddress, setProxyAddress] = useState('');
    const [implAddress, setImplAddress] = useState('');
    const [multiSigAddress, setMultiSigAddress] = useState('');
    const [isDeploying, setIsDeploying] = useState(false);
    const [error, setError] = useState('');
    const [signer, setSigner] = useState(null);
    const [account, setAccount] = useState('');
    const [initialValue, setInitialValue] = useState(0);
    const [useMultiSig, setUseMultiSig] = useState(false);
    const [multiSigOwners, setMultiSigOwners] = useState('');
    const [requiredApprovals, setRequiredApprovals] = useState(1);

    // Connect to wallet when component mounts
    useEffect(() => {
        const connectWallet = async () => {
            if (typeof window.ethereum !== 'undefined') {
                try {
                    // Request account access
                    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                    setAccount(accounts[0]);

                    // Create provider and signer
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const signer = await provider.getSigner();
                    setSigner(signer);
                } catch (error) {
                    console.error("Error connecting to wallet:", error);
                    setError("Failed to connect wallet. Please make sure MetaMask is installed and unlocked.");
                }
            } else {
                setError("MetaMask is not installed. Please install it to use this feature.");
            }
        };

        connectWallet();
    }, []);

    const handleDeploy = async () => {
        if (!signer) {
            setError("Please connect your wallet first");
            return;
        }

        try {
            setIsDeploying(true);
            setError('');

            let result;

            if (useMultiSig) {
                // Parse MultiSig owners from comma-separated string
                const owners = multiSigOwners
                    .split(',')
                    .map(addr => addr.trim())
                    .filter(addr => addr.length > 0);

                if (owners.length === 0) {
                    // Use current signer as default owner
                    owners.push(await signer.getAddress());
                }

                result = await deployUUPSContract(signer, initialValue, true, owners, requiredApprovals);
                setMultiSigAddress(result.multiSigWalletAddress);
            } else {
                result = await deployUUPSContract(signer, initialValue, false);
            }

            setProxyAddress(result.proxyAddress);
            setImplAddress(result.implementationAddress);

            // Save deployment info
            saveDeploymentInfo(result.deploymentInfo);
        } catch (err) {
            console.error('Deployment error:', err);
            setError(err.message);
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className="uups-deployer">
            <h2>Deploy UUPS Proxy Contract</h2>

            <div className="input-group">
                <label>
                    <input
                        type="checkbox"
                        checked={useMultiSig}
                        onChange={(e) => setUseMultiSig(e.target.checked)}
                    />
                    Use MultiSig Wallet as Owner
                </label>
            </div>

            {useMultiSig && (
                <>
                    <div className="input-group">
                        <label>
                            MultiSig Owners (comma-separated addresses):
                            <input
                                type="text"
                                value={multiSigOwners}
                                onChange={(e) => setMultiSigOwners(e.target.value)}
                                placeholder="0x123..., 0x456... (leave empty to use current account)"
                            />
                        </label>
                    </div>
                    <div className="input-group">
                        <label>
                            Required Approvals:
                            <input
                                type="number"
                                min="1"
                                value={requiredApprovals}
                                onChange={(e) => setRequiredApprovals(parseInt(e.target.value) || 1)}
                                placeholder="Number of required approvals"
                            />
                        </label>
                    </div>
                </>
            )}

            <div className="input-group">
                <label>
                    Initial Value:
                    <input
                        type="number"
                        value={initialValue}
                        onChange={(e) => setInitialValue(parseInt(e.target.value) || 0)}
                        placeholder="Enter initial value"
                        disabled={useMultiSig}
                    />
                </label>
                {useMultiSig && (
                    <small>Initial value cannot be set when using MultiSig (requires approval process)</small>
                )}
            </div>

            <button
                onClick={handleDeploy}
                disabled={isDeploying}
                className="deploy-button"
            >
                {isDeploying ? 'กำลัง Deploy...' : 'Deploy Contract'}
            </button>

            {error && <div className="error-message">{error}</div>}

            {proxyAddress && (
                <div className="deployment-result">
                    <h3>Deployment Successful!</h3>
                    <p><strong>Proxy Address:</strong> {proxyAddress}</p>
                    <p><strong>Implementation Address:</strong> {implAddress}</p>
                    {multiSigAddress && (
                        <p><strong>MultiSig Wallet Address:</strong> {multiSigAddress}</p>
                    )}
                    <p><strong>Initial Value:</strong> {useMultiSig ? 'Not set (requires MultiSig approval)' : initialValue}</p>

                    <div className="links">
                        <a
                            href={`https://sepolia.etherscan.io/address/${proxyAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View Proxy on Etherscan
                        </a>
                        <a
                            href={`https://sepolia.etherscan.io/address/${implAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View Implementation on Etherscan
                        </a>
                        {multiSigAddress && (
                            <a
                                href={`https://sepolia.etherscan.io/address/${multiSigAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View MultiSig on Etherscan
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}