// frontend/src/components/DeployPanel.jsx
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { deployUUPSContract } from '../utils/deployUUPSContract.jsx';

export default function DeployPanel({ signer }) {
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contractArtifacts, setContractArtifacts] = useState({
    multiSig: null,
    myContract: null,
    erc1967Proxy: null
  });

  // โหลด artifact เมื่อ component โหลด
  useEffect(() => {
    const loadArtifacts = async () => {
      try {
        const [multiSigArtifact, myContractArtifact, erc1967ProxyArtifact] = await Promise.all([
          fetch('/artifacts/MultiSigWallet.json?url').then(res => res.json()),
          fetch('/artifacts/MyContractV1.json?url').then(res => res.json()),
          /*           fetch('/artifacts/ERC1967Proxy.json?url').then(res => res.json()).catch(() => {
                      // Fallback if ERC1967Proxy.json is not available
                      return {
                    abi: [
                      {
                        "inputs": [
                          {
                            "internalType": "address",
                            "name": "_logic",
                            "type": "address"
                          },
                          {
                            "internalType": "bytes",
                            "name": "_data",
                            "type": "bytes"
                          }
                        ],
                        "stateMutability": "nonpayable",
                        "type": "constructor"
                      }
                    ],
                    bytecode: "0x608060405234801561001057600080fd5b5060405161072d38038061072d83398101604081905261002f91610213565b61003e826000191460056100a7565b61006a7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc8361010e565b6100928282600080366000846000015114601d6100a792919061015e565b50505061030a565b6100b060006101a8565b816000815181106100c3576100c36102f4565b602001516001600160a01b03167f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc6000546001600160a01b03161461010a57600080fd5b505050565b6000828260405160200161012392919061026e565b604051602081830303815290604052805190602001209050919050565b60006040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161019f9190610286565b60405180910390fd5b8051156101b6576101b681610207565b6101ff7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc8360405180606001604052806060815260200160608152602001606081525061010e565b5050565b3b151590565b6000806040838503121561022657600080fd5b82516001600160a01b038116811461023d57600080fd5b6020840151909250610100818114801561025757600080fd5b8060408601525092915050565b6000815180845260005b8181101561028b5760208185018101518683018201520161026f565b506000602082860101526020601f19601f83011685010191505092915050565b6020815260006102996020830184610265565b9392505050565b634e487b7160e01b600052603260045260246000fd5b610414806103196000396000f3fe60806040523661001357610011610017565b005b6100115b610027610022610067565b610100565b565b606061004e83836040518060600160405280602781526020016103b8602791396001600160a01b03831660009081526020819052604090205491906102a9565b9392505050565b73ffffffffffffffffffffffffffffffffffffffff163b151590565b90565b600061007161010a565b905090565b60006100a07f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc5490565b905090565b60006100ae61010a565b9050816001600160a01b0316638da5cb5b6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156100ec573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906100719190610346565b3660008037600080366000845af43d6000803e808015610121573d6000f35b3d6000fd5b90565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b600082601f83011261016a57600080fd5b813567ffffffffffffffff8082111561018557610185610126565b604051601f83017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0908116603f011681019082821181831017156101cb576101cb610126565b816040528381528660208588010111156101e457600080fd5b836020870160208301376000602085830101528094505050505092915050565b60008060006060848603121561021957600080fd5b833567ffffffffffffffff81111561023057600080fd5b61023c86828701610159565b9350506020848101356001600160a01b038116821461025a57600080fd5b9250604084013590509250925092565b6000815180845260005b8181101561028e57602081850181015186830182015201610272565b506000602082860101526020601f19601f83011685010191505092915050565b6060815260008084516060850152602085015160806060860152610100608086015261010086602087015260006102e2878301610268565b9150604087015160a0870152606087015160c0870152608087015160e087015260a087015161010087015260c087015161012087015260e087015161014087015261016086019150610332600186016102e2565b5090979650505050505050565b60006020828403121561035857600080fd5b81516001600160a01b038116811461004e57600080fdfea2646970667358221220d2ec357659d93a1d7a0c7a13d3a91a9c3c6f824b5c9e9c5f99d3de19e11ed80a64736f6c63430008130033"
                  };
                }) */
        ]);

        setContractArtifacts({
          multiSig: multiSigArtifact,
          myContract: myContractArtifact,
          erc1967Proxy: erc1967ProxyArtifact
        });
      } catch (err) {
        setStatus(`Error loading contract artifacts: ${err.message}`);
      }
    };

    loadArtifacts();
  }, []);

  const deployContract = async () => {
    if (!signer) {
      setStatus('Error: No signer available. Please connect your wallet.');
      return;
    }

    if (!contractArtifacts.multiSig) {
      setStatus('Error: Contract artifacts not loaded yet.');
      return;
    }

    setIsLoading(true);
    setStatus('Preparing deployment...');

    try {
      // 1. Deploy MultiSig Wallet
      setStatus('Deploying MultiSig Wallet...');

      const MultiSigWallet = new ethers.ContractFactory(
        contractArtifacts.multiSig.abi,
        contractArtifacts.multiSig.bytecode,
        signer
      );

      // Get owners for the MultiSig wallet
      const signerAddress = await signer.getAddress();
      const owners = [
        signerAddress,
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Second owner
      ];
      const required = 1; // For testing, we'll use 1 to make it easier to interact with

      const multiSig = await MultiSigWallet.deploy(owners, required);
      await multiSig.waitForDeployment();

      const multiSigAddress = await multiSig.getAddress();
      setStatus(`MultiSig deployed to: ${multiSigAddress}\nNow deploying UUPS proxy...`);

      // 2. Deploy UUPS Contract using utility function
      setStatus(prev => `${prev}\nDeploying UUPS proxy for MyContractV1...`);

      const uupsResult = await deployUUPSContract(signer);

      setStatus(prev => `${prev}\nImplementation deployed to: ${uupsResult.implementationAddress}`);
      setStatus(prev => `${prev}\nProxy deployed to: ${uupsResult.proxyAddress}`);

      // 3. Transfer ownership to MultiSig wallet
      setStatus(prev => `${prev}\nTransferring ownership to MultiSig wallet...`);

      try {
        const tx = await uupsResult.contract.transferOwnership(multiSigAddress);
        await tx.wait();
        setStatus(prev => `${prev}\nOwnership transferred to MultiSig wallet!`);
      } catch (err) {
        setStatus(prev => `${prev}\nFailed to transfer ownership: ${err.message}`);
      }

      setStatus(prev => `${prev}\nDeployment complete!`);

      // Save deployed addresses to local storage for easy access
      try {
        localStorage.setItem('deployedContracts', JSON.stringify({
          multiSig: multiSigAddress,
          implementation: uupsResult.implementationAddress,
          proxy: uupsResult.proxyAddress
        }));
      } catch (err) {
        console.error("Failed to save to localStorage:", err);
      }

      // Return the deployed addresses
      return {
        multiSig: multiSigAddress,
        implementation: uupsResult.implementationAddress,
        proxy: uupsResult.proxyAddress
      };

    } catch (err) {
      setStatus(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      border: '1px solid #ddd',
      padding: '15px',
      borderRadius: '5px',
      marginBottom: '20px'
    }}>
      <h2 style={{ marginTop: 0 }}>Deploy New Contract</h2>

      {!contractArtifacts.multiSig ? (
        <p>Loading contract artifacts...</p>
      ) : (
        <>
          <button
            onClick={deployContract}
            disabled={!signer || isLoading}
            style={{
              padding: '8px 12px',
              backgroundColor: signer && !isLoading ? '#4CAF50' : '#cccccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: signer && !isLoading ? 'pointer' : 'not-allowed'
            }}
          >
            {isLoading ? 'Deploying...' : 'Deploy with MultiSig'}
          </button>

          {status && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace'
            }}>
              {status.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}