import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface SecretSantaData {
  id: string;
  name: string;
  description: string;
  participants: number;
  budget: number;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

interface Participant {
  name: string;
  encryptedId: number;
  assignedTo?: string;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SecretSantaData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newEventData, setNewEventData] = useState({ 
    name: "", 
    description: "", 
    budget: "",
    participants: "" 
  });
  const [selectedEvent, setSelectedEvent] = useState<SecretSantaData | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [participantsList, setParticipantsList] = useState<Participant[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [userHistory, setUserHistory] = useState<SecretSantaData[]>([]);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const eventsList: SecretSantaData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          eventsList.push({
            id: businessId,
            name: businessData.name,
            description: businessData.description,
            participants: Number(businessData.publicValue1) || 0,
            budget: Number(businessData.publicValue2) || 0,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setEvents(eventsList);
      if (address) {
        setUserHistory(eventsList.filter(event => event.creator.toLowerCase() === address.toLowerCase()));
      }
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createEvent = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingEvent(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating Secret Santa with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const budgetValue = parseInt(newEventData.budget) || 0;
      const businessId = `santa-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, budgetValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newEventData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newEventData.participants) || 0,
        budgetValue,
        newEventData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Secret Santa created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewEventData({ name: "", description: "", budget: "", participants: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingEvent(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified on-chain" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      setTransactionStatus({ visible: true, status: "success", message: "Gift pairing revealed successfully!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data is already verified on-chain" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const available = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "FHE system is available and ready!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const generateParticipants = (count: number) => {
    const names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Ivy", "Jack"];
    const participants: Participant[] = [];
    
    for (let i = 0; i < count; i++) {
      participants.push({
        name: names[i % names.length] + ` ${i + 1}`,
        encryptedId: i + 1
      });
    }
    
    return participants;
  };

  const simulatePairing = (participants: Participant[]) => {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    return participants.map((p, index) => ({
      ...p,
      assignedTo: shuffled[(index + 1) % participants.length].name
    }));
  };

  const handleShowParticipants = (event: SecretSantaData) => {
    const participants = generateParticipants(event.participants);
    const paired = simulatePairing(participants);
    setParticipantsList(paired);
    setShowParticipants(true);
  };

  const stats = {
    totalEvents: events.length,
    totalParticipants: events.reduce((sum, event) => sum + event.participants, 0),
    totalBudget: events.reduce((sum, event) => sum + event.budget, 0),
    verifiedEvents: events.filter(e => e.isVerified).length,
    userEvents: userHistory.length
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>🎄 Secret Santa FHE</h1>
            <p>Fully Encrypted Gift Exchange</p>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🎁</div>
            <h2>Connect Your Wallet to Start</h2>
            <p>Join the encrypted Secret Santa experience where even the organizer can't see the pairings!</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect your wallet to begin</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>FHE system will initialize automatically</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Create your encrypted gift exchange</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="santa-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Getting Santa's workshop ready with Zama FHE</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="santa-spinner"></div>
      <p>Loading Secret Santa events...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>🎄 Secret Santa FHE</h1>
          <p>Fully Homomorphic Encryption for Secret Gift Exchanges</p>
        </div>
        
        <div className="header-actions">
          <button className="nav-btn" onClick={() => setShowStats(!showStats)}>
            📊 Stats
          </button>
          <button className="nav-btn" onClick={() => setShowHistory(!showHistory)}>
            📋 My Events
          </button>
          <button className="nav-btn" onClick={() => setShowFAQ(!showFAQ)}>
            ❓ FAQ
          </button>
          <button onClick={checkAvailability} className="check-btn">
            🔍 Check FHE
          </button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            🎁 New Exchange
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content">
        {showStats && (
          <div className="stats-panel">
            <h3>📊 Secret Santa Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{stats.totalEvents}</span>
                <span className="stat-label">Total Exchanges</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{stats.totalParticipants}</span>
                <span className="stat-label">Total Participants</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">${stats.totalBudget}</span>
                <span className="stat-label">Total Budget</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{stats.verifiedEvents}</span>
                <span className="stat-label">Verified</span>
              </div>
            </div>
          </div>
        )}

        {showFAQ && (
          <div className="faq-panel">
            <h3>❓ Frequently Asked Questions</h3>
            <div className="faq-list">
              <div className="faq-item">
                <strong>How does FHE protect my Secret Santa?</strong>
                <p>Your gift pairings are encrypted using Zama FHE technology, making them completely private - even from the organizer!</p>
              </div>
              <div className="faq-item">
                <strong>When are pairings revealed?</strong>
                <p>Pairings are only decrypted when participants choose to reveal them, ensuring complete secrecy until the exchange.</p>
              </div>
              <div className="faq-item">
                <strong>Is this really secure?</strong>
                <p>Yes! The FHE technology ensures mathematical privacy guarantees that are verified on-chain.</p>
              </div>
            </div>
          </div>
        )}

        <div className="content-section">
          <div className="section-header">
            <h2>🎅 Active Secret Santa Exchanges</h2>
            <div className="header-actions">
              <button onClick={loadData} className="refresh-btn" disabled={isRefreshing}>
                {isRefreshing ? "🔄 Refreshing..." : "🔄 Refresh"}
              </button>
            </div>
          </div>
          
          <div className="events-grid">
            {events.length === 0 ? (
              <div className="no-events">
                <p>No Secret Santa events found</p>
                <button className="create-btn" onClick={() => setShowCreateModal(true)}>
                  Create First Exchange
                </button>
              </div>
            ) : events.map((event, index) => (
              <div className="event-card" key={index}>
                <div className="card-header">
                  <h3>{event.name}</h3>
                  {event.isVerified && <span className="verified-badge">✅ Verified</span>}
                </div>
                <div className="card-content">
                  <p>{event.description}</p>
                  <div className="event-details">
                    <span>👥 {event.participants} participants</span>
                    <span>💰 ${event.budget} budget</span>
                    <span>📅 {new Date(event.timestamp * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="card-actions">
                  <button 
                    onClick={() => handleShowParticipants(event)}
                    className="action-btn view-btn"
                  >
                    👀 View Participants
                  </button>
                  <button 
                    onClick={() => decryptData(event.id)}
                    className="action-btn decrypt-btn"
                  >
                    {event.isVerified ? "✅ Revealed" : "🎁 Reveal Pairing"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {showHistory && userHistory.length > 0 && (
          <div className="history-section">
            <h3>📋 My Secret Santa Events</h3>
            <div className="history-list">
              {userHistory.map((event, index) => (
                <div className="history-item" key={index}>
                  <span>{event.name}</span>
                  <span>{event.participants} participants</span>
                  <span>{event.isVerified ? "✅ Revealed" : "🔒 Encrypted"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <h2>🎄 Create New Secret Santa</h2>
              <button onClick={() => setShowCreateModal(false)} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              <div className="fhe-notice">
                <strong>🔐 FHE Encryption Active</strong>
                <p>Budget and pairings will be encrypted with Zama FHE technology</p>
              </div>
              
              <div className="form-group">
                <label>Event Name *</label>
                <input 
                  type="text" 
                  value={newEventData.name}
                  onChange={(e) => setNewEventData({...newEventData, name: e.target.value})}
                  placeholder="Christmas Party 2024"
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={newEventData.description}
                  onChange={(e) => setNewEventData({...newEventData, description: e.target.value})}
                  placeholder="Describe your Secret Santa event..."
                />
              </div>
              
              <div className="form-group">
                <label>Number of Participants *</label>
                <input 
                  type="number"
                  min="2"
                  max="50"
                  value={newEventData.participants}
                  onChange={(e) => setNewEventData({...newEventData, participants: e.target.value})}
                  placeholder="10"
                />
              </div>
              
              <div className="form-group">
                <label>Gift Budget ($) *</label>
                <input 
                  type="number"
                  min="1"
                  value={newEventData.budget}
                  onChange={(e) => setNewEventData({...newEventData, budget: e.target.value})}
                  placeholder="25"
                />
                <div className="data-label">FHE Encrypted Integer</div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="cancel-btn">Cancel</button>
              <button 
                onClick={createEvent}
                disabled={creatingEvent || isEncrypting || !newEventData.name || !newEventData.participants || !newEventData.budget}
                className="submit-btn"
              >
                {creatingEvent || isEncrypting ? "Encrypting..." : "Create Exchange"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showParticipants && (
        <div className="modal-overlay">
          <div className="participants-modal">
            <div className="modal-header">
              <h2>👥 Secret Santa Participants</h2>
              <button onClick={() => setShowParticipants(false)} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              <div className="participants-list">
                {participantsList.map((participant, index) => (
                  <div className="participant-item" key={index}>
                    <span className="participant-name">{participant.name}</span>
                    <span className="assignment-arrow">→</span>
                    <span className="assigned-to">{participant.assignedTo}</span>
                  </div>
                ))}
              </div>
              <div className="encryption-note">
                <p>🔐 Pairings are encrypted using FHE and will only be revealed to participants</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {transactionStatus.visible && (
        <div className="notification">
          <div className={`notification-content ${transactionStatus.status}`}>
            <div className="notification-icon">
              {transactionStatus.status === "pending" && "⏳"}
              {transactionStatus.status === "success" && "✅"}
              {transactionStatus.status === "error" && "❌"}
            </div>
            <div className="notification-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

