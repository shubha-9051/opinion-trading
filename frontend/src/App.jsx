import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopicDisplay from './components/TopicDisplay';
import ProbabilityGraph from './components/ProbabilityGraph';
import OrderBook from './components/OrderBook';
import BuyButtons from './components/BuyButtons';
import TopicDetails from './components/TopicDetails';
import TopicSelector from './components/TopicSelector';
import useWebSocket from './hooks/useWebSocket';
import { useAuth } from './context/AuthContext';
import './styles/App.css';

function App() {
  const {
    isConnected,
    topics,
    selectedTopic,
    yesOrderbook,
    noOrderbook,
    error,
    selectTopic,
    reconnectAttempt
  } = useWebSocket();

  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  
  // User balance - in a real app this would come from your API
  const [userBalance] = useState({
    usd: 1250.75,
    pendingUsd: 125.50,
    yesShares: 75,
    noShares: 38
  });

  // Check authentication
  useEffect(() => {
    if (!currentUser) {
      navigate('/signin');
    }
  }, [currentUser, navigate]);

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  // Use mock data for development when the connection fails
  const useMockData = !isConnected && reconnectAttempt > 2;
  
  // Mock data for development when server is unavailable
  const mockTopic = {
    id: 'mock-1',
    name: "Example Topic (Server Offline)",
    description: "This is mock data shown because the WebSocket server is unavailable.",
    expiresAt: "2024-12-31"
  };
  
  const mockYesOrderbook = {
    asks: [
      { price: 0.65, quantity: 25.5 },
      { price: 0.64, quantity: 18.9 },
      { price: 0.63, quantity: 32.1 },
      { price: 0.62, quantity: 15.7 },
      { price: 0.61, quantity: 28.4 }
    ],
    bids: [
      { price: 0.60, quantity: 21.2 },
      { price: 0.59, quantity: 17.8 },
      { price: 0.58, quantity: 33.6 },
      { price: 0.57, quantity: 19.3 },
      { price: 0.56, quantity: 26.7 }
    ]
  };
  
  const mockNoOrderbook = {
    asks: [
      { price: 0.40, quantity: 22.4 },
      { price: 0.39, quantity: 17.2 },
      { price: 0.38, quantity: 31.5 },
      { price: 0.37, quantity: 14.3 },
      { price: 0.36, quantity: 24.8 }
    ],
    bids: [
      { price: 0.35, quantity: 20.1 },
      { price: 0.34, quantity: 16.5 },
      { price: 0.33, quantity: 28.9 },
      { price: 0.32, quantity: 18.2 },
      { price: 0.31, quantity: 25.3 }
    ]
  };
  
  // Use either real data or mock data
  const displayTopic = useMockData ? mockTopic : selectedTopic;
  const displayYesOrderbook = useMockData ? mockYesOrderbook : yesOrderbook;
  const displayNoOrderbook = useMockData ? mockNoOrderbook : noOrderbook;

  // Loading state
  if (!displayTopic) {
    return (
      <div className="app loading">
        <div className="container">
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
            {isConnected ? 'Connected, loading data...' : `Connecting to server (attempt ${reconnectAttempt})...`}
          </div>
          
          {error && (
            <div className="error-message">
              <p>{error}</p>
              <p className="error-help">Make sure your WebSocket server is running on localhost:8080</p>
            </div>
          )}
          
          <div className="loading-message">
            <p>{isConnected ? 'Loading topics...' : 'Waiting for connection...'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-left">
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
            {isConnected ? 'Connected' : `Connection lost (retry ${reconnectAttempt})...`}
          </div>
          
          {Object.keys(topics).length > 0 && (
            <TopicSelector 
              topics={topics} 
              selectedTopic={selectedTopic} 
              onSelect={selectTopic} 
            />
          )}
        </div>
        
        <div className="header-right">
          <div className="user-balance-container">
            <div className="balance-header">Your Balance</div>
            <div className="balance-amount">${userBalance.usd.toFixed(2)}</div>
            <div className="balance-details">
              <div className="balance-item">
                <span className="balance-label">Pending:</span>
                <span className="balance-value pending">${userBalance.pendingUsd.toFixed(2)}</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">YES Shares:</span>
                <span className="balance-value yes">{userBalance.yesShares}</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">NO Shares:</span>
                <span className="balance-value no">{userBalance.noShares}</span>
              </div>
              
              <div className="user-info">
                <span className="user-name">
                  {currentUser?.name || currentUser?.email || 'User'}
                </span>
                <button className="logout-button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {useMockData && (
        <div className="mock-data-notice">
          <p>⚠️ Displaying mock data - WebSocket server unavailable</p>
        </div>
      )}
      
      <div className="container">
        <TopicDisplay topic={displayTopic} />
        
        <div className="graph-container">
          <ProbabilityGraph />
        </div>
        
        <div className="orderbooks-container">
          <OrderBook 
            type="yes" 
            asks={displayYesOrderbook.asks || []} 
            bids={displayYesOrderbook.bids || []} 
          />
          <OrderBook 
            type="no" 
            asks={displayNoOrderbook.asks || []} 
            bids={displayNoOrderbook.bids || []} 
          />
        </div>
        
        <TopicDetails topic={displayTopic} />
      </div>
      
      <BuyButtons />
      
      {error && !useMockData && <div className="error-message">{error}</div>}
    </div>
  );
}

export default App;