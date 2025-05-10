import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocketContext } from '../context/useWebSocketContext';
import '../styles/MyOrders.css';
import axios from 'axios';

// Create an axios instance with the correct base URL
const api = axios.create({
  baseURL: 'http://localhost:3000', // Adjust this to match your API server URL
  withCredentials: true
});

const MyOrders = ({ onBack }) => {
  const { currentUser } = useAuth();
  const ws = useWebSocketContext();
  const [userShares, setUserShares] = useState({});
  const [openOrders, setOpenOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for sell form
  const [selectedAsset, setSelectedAsset] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellQuantity, setSellQuantity] = useState('');
  const [sellStatus, setSellStatus] = useState('');
  
  // State for on-ramp form
  const [showOnRamp, setShowOnRamp] = useState(false);
  const [onRampAmount, setOnRampAmount] = useState('');
  const [onRampStatus, setOnRampStatus] = useState('');

  // Fetch user's orders and balances when component mounts
  useEffect(() => {
    if (!currentUser) return;
    
    fetchUserOrders();
    
    // Set up WebSocket listeners for real-time updates
    const handleOrderUpdates = (message) => {
      console.log('Order update received:', message);
      fetchUserOrders(); // Refresh data when orders change
    };
    
    if (ws.isConnected) {
      ws.addResponseListener('ORDER_EXECUTED', handleOrderUpdates);
      ws.addResponseListener('ORDER_PARTIALLY_FILLED', handleOrderUpdates);
      ws.addResponseListener('ORDER_CANCELED', handleOrderUpdates);
      ws.addResponseListener('ON_RAMP_SUCCESS', handleOrderUpdates);
    }
    
    return () => {
      if (ws.isConnected) {
        ws.removeResponseListener('ORDER_EXECUTED', handleOrderUpdates);
        ws.removeResponseListener('ORDER_PARTIALLY_FILLED', handleOrderUpdates);
        ws.removeResponseListener('ORDER_CANCELED', handleOrderUpdates);
        ws.removeResponseListener('ON_RAMP_SUCCESS', handleOrderUpdates);
      }
    };
  }, [currentUser, ws.isConnected]);

  const fetchUserOrders = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    console.log('Fetching orders for user:', currentUser.username);
    
    try {
      // Get markets based on selected topic or available topics
      const markets = [];
      
      if (ws.selectedTopic) {
        markets.push(`${ws.selectedTopic.id}-yes-usd`);
        markets.push(`${ws.selectedTopic.id}-no-usd`);
      } else {
        // Fallback to available topics
        const availableTopics = Object.keys(ws.topics);
        if (availableTopics.length > 0) {
          availableTopics.forEach(topicId => {
            markets.push(`${topicId}-yes-usd`);
            markets.push(`${topicId}-no-usd`);
          });
        } else {
          // Default to market ID 1 if no topics available
          markets.push('1-yes-usd');
          markets.push('1-no-usd');
        }
      }
      
      // Combine results from all markets
      const allOrders = [];
      let combinedBalances = { USD: 0 };
      
      for (const market of markets) {
        try {
          console.log(`Fetching orders for market: ${market}`);
          
          // Use the correct endpoint path from your orderRouter
          const response = await api.get('/order/open', {
            params: {
              market: market,
              userId: currentUser.username
            }
          });
          
          console.log('API response:', response.data);
          
          if (response.data && response.data.data) {
            // Add orders from this market
            if (response.data.data.orders && Array.isArray(response.data.data.orders)) {
              allOrders.push(...response.data.data.orders);
            }
            
            // Update combined balances
            if (response.data.data.userBalance && response.data.data.userBalance.balances) {
              const balances = response.data.data.userBalance.balances;
              
              // Merge balances - add to existing or create new
              Object.entries(balances).forEach(([asset, amount]) => {
                if (combinedBalances[asset] === undefined) {
                  combinedBalances[asset] = amount;
                } else if (asset === 'USD') {
                  // Only take the highest USD balance to avoid double-counting
                  combinedBalances[asset] = Math.max(combinedBalances[asset], amount);
                } else {
                  combinedBalances[asset] = (combinedBalances[asset] || 0) + amount;
                }
              });
            }
          }
        } catch (err) {
          console.error(`Error fetching orders for market ${market}:`, err);
          // Continue with other markets even if one fails
        }
      }
      
      // Update state with combined results
      setOpenOrders(allOrders);
      setUserShares(combinedBalances);
      setLoading(false);
      
    } catch (err) {
      console.error("Error fetching user orders:", err);
      setError("Failed to load your orders. Please try again later.");
      setLoading(false);
      
      // Fallback to WebSocket method if REST API fails
      fetchUserOrdersViaWebSocket();
    }
  };
  
  // Fallback method using WebSocket
  const fetchUserOrdersViaWebSocket = () => {
    if (!ws.isConnected || !currentUser) return;
    
    console.log('Falling back to WebSocket for fetching orders');
    
    // Set up a one-time listener for the response
    const handleOrdersResponse = (message) => {
      console.log('WebSocket orders response:', message);
      
      if (message.data) {
        setOpenOrders(message.data.orders || []);
        
        if (message.data.userBalance && message.data.userBalance.balances) {
          setUserShares(message.data.userBalance.balances);
        }
        
        setLoading(false);
        ws.removeResponseListener('OPEN_ORDERS', handleOrdersResponse);
      }
    };
    
    ws.addResponseListener('OPEN_ORDERS', handleOrdersResponse);
    
    // Send WebSocket request
    const market = ws.selectedTopic ? `${ws.selectedTopic.id}-yes-usd` : '1-yes-usd';
    
    ws.sendMessage({
      type: 'GET_OPEN_ORDER',
      data: {
        market: market,
        userId: currentUser.username
      }
    });
    
    // Set timeout in case we don't get a response
    setTimeout(() => {
      if (loading) {
        ws.removeResponseListener('OPEN_ORDERS', handleOrdersResponse);
        setError("Timed out waiting for orders data.");
        setLoading(false);
      }
    }, 10000);
  };
  
  // Function to cancel an order using the REST API
  const handleCancelOrder = async (orderId) => {
    if (!currentUser) return;
    
    console.log(`Cancelling order: ${orderId}`);
    setSellStatus('Cancelling order...');
    
    try {
      // Use the POST /order/cancel endpoint
      const response = await api.post('/order/cancel', {
        orderId: orderId,
        userId: currentUser.username
      });
      
      console.log('Cancel order response:', response.data);
      
      // Refresh the orders list
      fetchUserOrders();
      setSellStatus('Order cancelled successfully!');
      setTimeout(() => setSellStatus(''), 3000);
      
    } catch (err) {
      console.error("Error cancelling order:", err);
      setSellStatus('Failed to cancel order. Please try again.');
      setTimeout(() => setSellStatus(''), 5000);
    }
  };
  
  // Function to place a sell order using the REST API
  const handleSellOrder = async (e) => {
    e.preventDefault();
    if (!selectedAsset || !sellPrice || !sellQuantity || !currentUser) return;
    
    // Parse asset to get topic ID and share type
    const parts = selectedAsset.split('-');
    if (parts.length < 2) {
      setSellStatus('Invalid asset format');
      return;
    }
    
    const topicId = parts[0];
    const shareType = parts[1];
    const market = `${topicId}-${shareType}-usd`;
    
    console.log(`Placing sell order for ${sellQuantity} shares of ${market} at $${sellPrice}`);
    setSellStatus('Placing order...');
    
    try {
      // Use the POST /order endpoint
      const response = await api.post('/order', {
        market: market,
        price: parseFloat(sellPrice),
        quantity: parseFloat(sellQuantity),
        side: 'sell',
        userId: currentUser.username
      });
      
      console.log('Sell order response:', response.data);
      
      // Refresh the orders list
      fetchUserOrders();
      setSellStatus('Order placed successfully!');
      
      // Clear form
      setSellPrice('');
      setSellQuantity('');
      setTimeout(() => setSellStatus(''), 3000);
      
    } catch (err) {
      console.error("Error placing sell order:", err);
      setSellStatus('Failed to place order. Please try again.');
      setTimeout(() => setSellStatus(''), 5000);
    }
  };
  
  // Function to handle on-ramp (adding USD)
  const handleOnRamp = async (e) => {
    e.preventDefault();
    if (!onRampAmount || !currentUser) return;
    
    console.log(`Processing on-ramp of $${onRampAmount} for ${currentUser.username}`);
    setOnRampStatus('Processing...');
    
    try {
      // Use the POST /order/onramp endpoint
      const response = await api.post('/order/onramp', {
        userId: currentUser.username,
        asset: 'USD',
        amount: parseFloat(onRampAmount)
      });
      
      console.log('On-ramp response:', response.data);
      
      // Refresh the orders list to update balances
      fetchUserOrders();
      setOnRampStatus('Funds added successfully!');
      
      // Clear form
      setOnRampAmount('');
      setTimeout(() => {
        setOnRampStatus('');
        setShowOnRamp(false);
      }, 3000);
      
    } catch (err) {
      console.error("Error processing on-ramp:", err);
      setOnRampStatus('Failed to add funds. Please try again.');
      setTimeout(() => setOnRampStatus(''), 5000);
    }
  };
  
  // Helper function to format asset names
  const formatAssetName = (asset) => {
    if (asset === 'USD') return 'USD';
    
    const parts = asset.split('-');
    if (parts.length < 2) return asset;
    
    // Find the topic name if available
    const topicId = parts[0];
    const shareType = parts[1].toUpperCase();
    
    // Try to get topic name from WS context
    let topicName = `Topic ${topicId}`;
    if (ws.topics && ws.topics[topicId] && ws.topics[topicId].name) {
      topicName = ws.topics[topicId].name;
    }
    
    return `${topicName} (${shareType})`;
  };
  
  // Helper function to format the market name for orders
  const formatMarket = (order) => {
    if (order.market) {
      return formatAssetName(order.market);
    }
    
    // Try to extract market from orderId if market is missing
    // This is a fallback if your backend doesn't include market in the order object
    if (order.orderId && order.orderId.includes('-')) {
      const parts = order.orderId.split('-');
      if (parts.length >= 2) {
        return formatAssetName(`${parts[0]}-${order.side}`);
      }
    }
    
    return `Unknown (${order.side})`;
  };
  
  // Format date from timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    return new Date(Number(timestamp)).toLocaleString();
  };
  
  // Filter out USD and zero balances from shares
  const shareAssets = Object.entries(userShares || {})
    .filter(([asset, balance]) => asset !== 'USD' && balance > 0)
    .sort(([assetA], [assetB]) => assetA.localeCompare(assetB));

  return (
    <div className="my-orders">
      <div className="my-orders-header">
        <h1>My Orders & Shares</h1>
        <button className="back-button" onClick={onBack}>Back to Market</button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {loading ? (
        <div className="loading">Loading your orders and shares...</div>
      ) : (
        <>
          <div className="user-shares">
            <h2>My Shares</h2>
            {shareAssets.length === 0 ? (
              <p className="no-data">You don't own any shares yet.</p>
            ) : (
              <div className="shares-list">
                <table>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Balance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareAssets.map(([asset, balance]) => (
                      <tr key={asset}>
                        <td>{formatAssetName(asset)}</td>
                        <td>{Number(balance).toFixed(2)}</td>
                        <td>
                          <button 
                            className="sell-button"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setSellQuantity(balance.toString());
                            }}
                          >
                            Sell Shares
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="usd-balance">
              <div className="balance-display">
                <h3>USD Balance: ${Number(userShares.USD || 0).toFixed(2)}</h3>
                <button className="add-funds-button" onClick={() => setShowOnRamp(!showOnRamp)}>
                  {showOnRamp ? 'Cancel' : 'Add Funds'}
                </button>
              </div>
              
              {showOnRamp && (
                <div className="onramp-form">
                  <h4>Add USD to your account</h4>
                  <form onSubmit={handleOnRamp}>
                    <div className="form-group">
                      <label>Amount ($):</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="1" 
                        value={onRampAmount} 
                        onChange={(e) => setOnRampAmount(e.target.value)} 
                        required
                      />
                    </div>
                    <button type="submit" className="submit-button">Add Funds</button>
                    {onRampStatus && <div className="onramp-status">{onRampStatus}</div>}
                  </form>
                </div>
              )}
            </div>
          </div>
          
          {selectedAsset && (
            <div className="sell-form">
              <h2>Sell {formatAssetName(selectedAsset)}</h2>
              <form onSubmit={handleSellOrder}>
                <div className="form-group">
                  <label>Quantity:</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.01" 
                    max={userShares[selectedAsset] || 0} 
                    value={sellQuantity} 
                    onChange={(e) => setSellQuantity(e.target.value)} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Price (USD):</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.01" 
                    max="0.99" 
                    value={sellPrice} 
                    onChange={(e) => setSellPrice(e.target.value)} 
                    required
                  />
                </div>
                <div className="form-group">
                  <button type="submit" className="submit-button">Place Sell Order</button>
                  <button 
                    type="button" 
                    className="cancel-button" 
                    onClick={() => setSelectedAsset('')}
                  >
                    Cancel
                  </button>
                </div>
                {sellStatus && <div className="sell-status">{sellStatus}</div>}
              </form>
            </div>
          )}
          
          <div className="open-orders">
            <h2>My Open Orders</h2>
            {openOrders.length === 0 ? (
              <p className="no-data">You don't have any open orders.</p>
            ) : (
              <div className="orders-list">
                <table>
                  <thead>
                    <tr>
                      <th>Market</th>
                      <th>Side</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map((order) => (
                      <tr key={order.orderId}>
                        <td>{formatMarket(order)}</td>
                        <td className={order.side}>{order.side.toUpperCase()}</td>
                        <td>${Number(order.price).toFixed(2)}</td>
                        <td>{Number(order.quantity).toFixed(2)}</td>
                        <td>{formatDate(order.timestamp)}</td>
                        <td>
                          <button 
                            className="cancel-order-button"
                            onClick={() => handleCancelOrder(order.orderId)}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MyOrders;