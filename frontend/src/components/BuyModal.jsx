import { useState, useEffect, useCallback } from 'react';
import '../styles/BuyModal.css';
import { useAuth } from '../context/AuthContext';

function BuyModal({ 
  isOpen, 
  onClose, 
  topicId, 
  initialShareType, 
  topicQuestion, 
  yesOrderbook, 
  noOrderbook,
  onOrderResponse  // Add this prop for handling responses
}) {
  const [shareType, setShareType] = useState(initialShareType);
  const [price, setPrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [sliderValue, setSliderValue] = useState(50); // For price slider
  const [maxQuantity, setMaxQuantity] = useState(100);
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Calculate potential profit
  const potentialReturn = quantity * 10; // Assuming max return is 10 per share

  // Initialize price and available quantity based on orderbook
  useEffect(() => {
    if (isOpen) {
      const orderbook = shareType === 'yes' ? yesOrderbook : noOrderbook;
      
      // Default prices based on orderbook or fallback values
      const defaultPrice = shareType === 'yes' ? 7.0 : 3.0;
      setPrice(defaultPrice);
      
      // Set available quantity based on orderbook
      if (orderbook && orderbook.asks && orderbook.asks.length > 0) {
        // Sum up available quantity from asks (selling orders)
        const availableQty = orderbook.asks.reduce((sum, ask) => sum + ask.quantity, 0);
        setMaxQuantity(availableQty || 100);
      } else {
        setMaxQuantity(100); // Default if no data
      }
      
      setQuantity(1);
    }
  }, [isOpen, shareType, yesOrderbook, noOrderbook]);

  // Switch between Yes and No share types
  const toggleShareType = (type) => {
    if (type !== shareType) {
      setShareType(type);
      
      // When switching, adjust the price to show complementary value
      if (type === 'yes') {
        setPrice(7.0); // Default yes price
      } else {
        setPrice(3.0); // Default no price
      }
      
      // Also update the slider
      setSliderValue(type === 'yes' ? 70 : 30);
    }
  };

  // Fix: Properly define the handlePriceSliderChange function
  const handlePriceSliderChange = (e) => {
    const value = parseInt(e.target.value);
    setSliderValue(value);
    
    // Calculate price based on slider (0-100 scale)
    const newPrice = parseFloat((value / 10).toFixed(1));
    setPrice(newPrice);
  };

  // Handle direct price input
  const handlePriceChange = (e) => {
    let newPrice = parseFloat(e.target.value);
    if (isNaN(newPrice)) newPrice = 0;
    
    // Clamp between 0 and 10
    newPrice = Math.min(Math.max(newPrice, 0), 10);
    setPrice(newPrice);
    
    // Update slider to match
    setSliderValue(newPrice * 10);
  };

  // Handle quantity changes
  const handleQuantityChange = (e) => {
    const newQuantity = parseInt(e.target.value);
    if (!isNaN(newQuantity) && newQuantity > 0) {
      setQuantity(Math.min(newQuantity, maxQuantity));
    }
  };

  const incrementQuantity = () => {
    if (quantity < maxQuantity) {
      setQuantity(quantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      setError('You need to be logged in to place orders');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const orderData = {
        market: `${topicId}-${shareType}-usd`,
        price: price,
        quantity: quantity,
        side: "buy",
        userId: currentUser.username
      };
      
      console.log('Submitting order:', orderData);
      
      // Send the order to the backend
      const response = await fetch('http://localhost:3000/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify(orderData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to place order');
      }
      
      const result = await response.json();
      console.log('Order placed successfully:', result);
      
      // Pass the response back to the parent component
      if (onOrderResponse) {
        onOrderResponse(result);
      }
      
      setLoading(false);
      onClose();
      // Show success notification here if needed
      
    } catch (err) {
      console.error('Error placing order:', err);
      setError(err.message || 'Failed to place order');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="buy-modal">
        <h2>{topicQuestion}</h2>
        
        <div className="order-options">
          <div className="option-buttons">
            <button 
              className={`option-yes ${shareType === 'yes' ? 'active' : ''}`}
              onClick={() => toggleShareType('yes')}
            >
              Yes ₹{7.0}
            </button>
            <button 
              className={`option-no ${shareType === 'no' ? 'active' : ''}`}
              onClick={() => toggleShareType('no')}
            >
              No ₹{3.0}
            </button>
          </div>

          <div className="price-section">
            <div className="price-header">
              <span>Price</span>
              <span>₹{price.toFixed(1)}</span>
            </div>
            <div className="qty-available">{maxQuantity} qty available</div>
            
            <div className="slider-container">
              <button 
                className="slider-button decrease" 
                onClick={() => {
                  const newPrice = Math.max(0, price - 0.1);
                  setPrice(parseFloat(newPrice.toFixed(1)));
                  setSliderValue(newPrice * 10);
                }}
              >
                −
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderValue}
                onChange={handlePriceSliderChange}  // This line was causing the error
                className="price-slider"
              />
              <button 
                className="slider-button increase" 
                onClick={() => {
                  const newPrice = Math.min(10, price + 0.1);
                  setPrice(parseFloat(newPrice.toFixed(1)));
                  setSliderValue(newPrice * 10);
                }}
              >
                +
              </button>
            </div>
          </div>

          <div className="quantity-section">
            <div className="quantity-header">
              <span>Quantity</span>
              <span>{quantity}</span>
            </div>
            
            <div className="quantity-controls">
              <button className="quantity-button" onClick={decrementQuantity}>−</button>
              <input
                type="number"
                value={quantity}
                onChange={handleQuantityChange}
                min="1"
                max={maxQuantity}
              />
              <button className="quantity-button" onClick={incrementQuantity}>+</button>
            </div>
          </div>
        </div>
        
        <div className="order-summary">
          <div className="cost-row">
            <span>You put in</span>
            <span>₹{(price * quantity).toFixed(1)}</span>
          </div>
          <div className="return-row">
            <span>You Get</span>
            <span className="potential-return">₹{potentialReturn.toFixed(1)}</span>
          </div>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="modal-actions">
          <button className="cancel-button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="place-order-button" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BuyModal;