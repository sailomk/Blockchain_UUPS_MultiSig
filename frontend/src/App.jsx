// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import UpgradePanel from './components/UpgradePanel';
import UUPSDeployer from './components/UUPSDeployer';
import DeployMyContractV1 from './components/DeployMyContractV1';

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [proxyAddress, setProxyAddress] = useState('');
  const [error, setError] = useState(null);

  // ตรวจสอบว่า MetaMask ติดตั้งหรือไม่
  const isMetaMaskInstalled = () => {
    return typeof window.ethereum !== 'undefined';
  };

  // เชื่อมต่อ Wallet
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      setError('Please install MetaMask first!');
      return;
    }

    try {
      // ขออนุญาตเชื่อมต่อ Wallet
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      const web3Provider = new BrowserProvider(window.ethereum);
      const signer = await web3Provider.getSigner();

      setProvider(web3Provider);
      setSigner(signer);
      setAccount(accounts[0]);
      setError(null);

      // เตรียม listener สำหรับเมื่อผู้ใช้เปลี่ยนบัญชี
      window.ethereum.on('accountsChanged', (newAccounts) => {
        setAccount(newAccounts[0] || null);
        if (newAccounts.length > 0) {
          web3Provider.getSigner().then(newSigner => {
            setSigner(newSigner);
          });
        } else {
          setSigner(null);
        }
      });

      // เตรียม listener สำหรับเมื่อผู้ใช้เปลี่ยนเครือข่าย
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

    } catch (err) {
      setError(`Failed to connect wallet: ${err.message}`);
      console.error(err);
    }
  };

  // ตรวจสอบเมื่อโหลดหน้าเว็บครั้งแรกว่ามี Wallet เชื่อมต่ออยู่แล้วหรือไม่
  useEffect(() => {
    const checkConnectedWallet = async () => {
      if (isMetaMaskInstalled() && window.ethereum.selectedAddress) {
        try {
          const web3Provider = new BrowserProvider(window.ethereum);
          const signer = await web3Provider.getSigner();

          setProvider(web3Provider);
          setSigner(signer);
          setAccount(window.ethereum.selectedAddress);
        } catch (err) {
          console.error("Error checking connected wallet:", err);
        }
      }
    };

    checkConnectedWallet();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>MultiSig UUPS Contract Manager</h1>

      {error && (
        <div style={{ color: 'red', margin: '10px 0' }}>
          {error}
        </div>
      )}

      {!account ? (
        <button
          onClick={connectWallet}
          style={{
            padding: '10px 15px',
            backgroundColor: '#f6851b',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Connect MetaMask Wallet
        </button>
      ) : (
        <>
          <div style={{ margin: '10px 0' }}>
            Connected as: <strong>{account}</strong>
          </div>


          <DeployMyContractV1 signer={signer} />
          <hr style={{ margin: '20px 0' }} />
          <UpgradePanel signer={signer} proxyAddress={proxyAddress} />
          <hr style={{ margin: '20px 0' }} />

        </>
      )}
    </div>
  );
}

export default App;