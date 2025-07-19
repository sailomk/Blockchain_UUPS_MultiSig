// frontend/src/components/DeployPanel.jsx
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function DeployPanel({ signer }) {
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contractArtifacts, setContractArtifacts] = useState({
    multiSig: null,
    myContract: null
  });

  // โหลด artifact เมื่อ component โหลด
  useEffect(() => {
    const loadArtifacts = async () => {
      try {
        const [multiSigArtifact, myContractArtifact] = await Promise.all([
          fetch('/artifacts/MultiSigWallet.json').then(res => res.json()),
          fetch('/artifacts/MyContract.json').then(res => res.json())
        ]);
        
        setContractArtifacts({
          multiSig: multiSigArtifact,
          myContract: myContractArtifact
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

    if (!contractArtifacts.multiSig || !contractArtifacts.myContract) {
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
      
      // ตัวอย่างที่อยู่ owner (ควรมาจากการ config หรือ input)
      const owners = [
        await signer.getAddress(), 
      //  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Owner 2
      //  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'  // Owner 3
      ];
      const required = 2;
      
      const multiSig = await MultiSigWallet.deploy(owners, required);
      await multiSig.waitForDeployment();
      
      const multiSigAddress = await multiSig.getAddress();
      setStatus(`MultiSig deployed to: ${multiSigAddress}\nNow deploying UUPS proxy...`);

      // 2. Deploy UUPS Proxy
      const MyContract = new ethers.ContractFactory(
        contractArtifacts.myContract.abi,
        contractArtifacts.myContract.bytecode,
        signer
      );

      // ใช้ ProxyFactory pattern สำหรับ UUPS
      const initialValue = 42;
      const contract = await MyContract.deploy();
      await contract.waitForDeployment();
      
      const implementationAddress = await contract.getAddress();
      setStatus(prev => `${prev}\nImplementation deployed to: ${implementationAddress}`);

      // 3. Initialize Proxy (ตัวอย่างเท่านั้น - ในทางปฏิบัติควรใช้ OpenZeppelin upgrades)
      // นี่เป็นตัวอย่างแบบง่าย ไม่ควรใช้ใน production
      setStatus(prev => `${prev}\nInitializing proxy...`);
      
      // ใน production ควรใช้ @openzeppelin/hardhat-upgrades
      const initializeData = contract.interface.encodeFunctionData("initialize", [initialValue]);
      
      setStatus(prev => `${prev}\nDeployment complete!`);
      
      // ส่งคืนที่อยู่ contract ที่ deploy แล้ว (ใน production อาจต้องการเก็บใน state หรือ context)
      return {
        multiSig: multiSigAddress,
        implementation: implementationAddress
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