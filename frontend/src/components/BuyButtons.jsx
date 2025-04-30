import { useState } from 'react';
import BuyModal from './BuyModal';
import UserBalance from './UserBalance';
import '../styles/BuyButtons.css';
import useWebSocket from '../hooks/useWebSocket';

function BuyButtons() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedShareType, setSelectedShareType] = useState(null);
  const [balanceUpdate, setBalanceUpdate] = useState(null);
  
  const { 
    selectedTopic, 
    yesOrderbook, 
    noOrderbook 
  } = useWebSocket();

  const handleBuyYes = () => {
    setSelectedShareType('yes');
    setModalOpen(true);
  };
  
  const handleBuyNo = () => {
    setSelectedShareType('no');
    setModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setModalOpen(false);
  };
  
  // Handle order response and update balance
  const handleOrderResponse = (response) => {
    console.log('BuyButtons - Received order response:', response);
    
    // Check for different response types
    if (response && response.type && response.data) {
      if (response.data.userBalance) {
        console.log('Updating balance from response:', response.data.userBalance);
        setBalanceUpdate(response.data.userBalance);
      }
    }
  };
  
  // Get the topic question if available
  const topicQuestion = selectedTopic?.question || 
    "Bitcoin is forecasted to be priced at 94527.59 USDT or more at 02:10 PM?";
  
  return (
    <div className="buy-section">
      <UserBalance balanceUpdate={balanceUpdate} />
      
      <div className="buy-buttons">
        <button className="buy-yes" onClick={handleBuyYes}>
          Buy YES
        </button>
        <button className="buy-no" onClick={handleBuyNo}>
          Buy NO
        </button>
      </div>
      
      <BuyModal 
        isOpen={modalOpen}
        onClose={handleCloseModal}
        topicId={selectedTopic?.id || "1"}
        initialShareType={selectedShareType}
        topicQuestion={topicQuestion}
        yesOrderbook={yesOrderbook}
        noOrderbook={noOrderbook}
        onOrderResponse={handleOrderResponse}
      />
    </div>
  );
}

export default BuyButtons;