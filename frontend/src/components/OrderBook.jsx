import { useMemo } from 'react';
import '../styles/OrderBook.css';

function OrderBook({ type, asks, bids }) {
  // Sort orders: asks ascending by price, bids descending by price
  const sortedAsks = useMemo(() => {
    return [...(asks || [])]
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);
  }, [asks]);
  
  const sortedBids = useMemo(() => {
    return [...(bids || [])]
      .sort((a, b) => b.price - a.price)
      .slice(0, 5);
  }, [bids]);
  
  // Fill with placeholders if needed
  const displayAsks = useMemo(() => {
    const result = [...sortedAsks];
    while (result.length < 5) {
      result.push({ price: 0, quantity: 0, placeholder: true });
    }
    return result;
  }, [sortedAsks]);
  
  const displayBids = useMemo(() => {
    const result = [...sortedBids];
    while (result.length < 5) {
      result.push({ price: 0, quantity: 0, placeholder: true });
    }
    return result;
  }, [sortedBids]);
  
  // Calculate maximum quantity for depth visualization
  const maxQuantity = useMemo(() => {
    const allOrders = [...(asks || []), ...(bids || [])];
    if (allOrders.length === 0) return 1; // Avoid division by zero
    
    return Math.max(...allOrders.map(order => order.quantity || 0));
  }, [asks, bids]);

  return (
    <div className="orderbook">
      <h2 className={`orderbook-title ${type}`}>{type.toUpperCase()} Orderbook</h2>
      
      <div className="orderbook-content">
        <div className="orderbook-header">
          <div>Price</div>
          <div style={{ textAlign: 'right' }}>Quantity</div>
        </div>
        
        <div className="orderbook-asks">
          {displayAsks.map((ask, index) => (
            <div 
              className={`orderbook-row ask ${ask.placeholder ? 'placeholder' : ''}`}
              key={`ask-${index}`}
            >
              {!ask.placeholder && (
                <div 
                  className="depth-bar" 
                  style={{ 
                    width: `${(ask.quantity / maxQuantity) * 100}%`
                  }}
                />
              )}
              <div className="price">
                {ask.placeholder ? '-' : ask.price.toFixed(2)}
              </div>
              <div className="quantity">
                {ask.placeholder ? '-' : ask.quantity.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        
        <div className="orderbook-bids">
          {displayBids.map((bid, index) => (
            <div 
              className={`orderbook-row bid ${bid.placeholder ? 'placeholder' : ''}`}
              key={`bid-${index}`}
            >
              {!bid.placeholder && (
                <div 
                  className="depth-bar" 
                  style={{ 
                    width: `${(bid.quantity / maxQuantity) * 100}%` 
                  }}
                />
              )}
              <div className="price">
                {bid.placeholder ? '-' : bid.price.toFixed(2)}
              </div>
              <div className="quantity">
                {bid.placeholder ? '-' : bid.quantity.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default OrderBook;