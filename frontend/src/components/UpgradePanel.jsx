// frontend/src/components/UpgradePanel.jsx
import { useState } from 'react';
import { ethers } from 'ethers';

export default function UpgradePanel({ signer, proxyAddress }) {
  const [newName, setNewName] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const proposeUpgrade = async () => {
    if (!signer) {
      setStatus('Error: No signer available. Please connect your wallet.');
      return;
    }

    if (!proxyAddress) {
      setStatus('Error: No proxy address provided.');
      return;
    }

    setIsLoading(true);
    setStatus('Preparing upgrade proposal...');

    try {
      setStatus('Preparing new implementation...');
      
      // ใน production ควรทำผ่าน backend
      const MyContractV2 = new ethers.ContractFactory(
        [
          "function initialize(uint value) public",
          "function setValue(uint _value) public",
          "function setName(string memory _name) public",
          "function name() public view returns (string memory)"
        ],
        "0x608060405234801561001057600080fd5b506...", // ใส่ bytecode ที่นี่
        signer
      );
      
      // ตัวอย่างเท่านั้น - ไม่ควร deploy จาก frontend โดยตรง
      setStatus('Submitting upgrade proposal to MultiSig...');
      
      // ตัวอย่างการเรียกใช้ MultiSig (ต้องปรับให้ตรงกับ contract จริง)
      const multiSigAddress = "0x..."; // ใส่ที่อยู่ MultiSig ที่ deploy แล้ว
      const multiSig = new ethers.Contract(
        multiSigAddress,
        [
          "function submit(address to, uint value, bytes calldata data) external",
          "function approve(uint txId) external",
          "function execute(uint txId) external"
        ],
        signer
      );
      
      // สร้าง transaction data สำหรับ upgrade
      const proxyAdminAddress = "0x..."; // ใส่ที่อยู่ ProxyAdmin
      const proxyAdmin = new ethers.Contract(
        proxyAdminAddress,
        ["function upgrade(address proxy, address implementation) external"],
        signer
      );
      
      const upgradeData = proxyAdmin.interface.encodeFunctionData("upgrade", [
        proxyAddress,
        "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" // ใส่ที่อยู่ implementation ใหม่
      ]);
      
      // ส่ง proposal ไปยัง MultiSig
      const tx = await multiSig.submit(
        proxyAdminAddress,
        0,
        upgradeData
      );
      
      await tx.wait();
      setStatus('Upgrade proposed successfully! Owners need to approve.');
      
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
      borderRadius: '5px'
    }}>
      <h2 style={{ marginTop: 0 }}>Upgrade Contract</h2>
      
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          New Feature Name:
        </label>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Enter new feature name"
          style={{
            padding: '8px',
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
      </div>
      
      <button
        onClick={proposeUpgrade}
        disabled={!signer || !proxyAddress || isLoading}
        style={{
          padding: '8px 12px',
          backgroundColor: signer && proxyAddress && !isLoading ? '#2196F3' : '#cccccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: signer && proxyAddress && !isLoading ? 'pointer' : 'not-allowed'
        }}
      >
        {isLoading ? 'Processing...' : 'Propose Upgrade'}
      </button>
      
      {status && (
        <div style={{ 
          marginTop: '10px',
          padding: '10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap'
        }}>
          {status}
        </div>
      )}
    </div>
  );
}