import { useState, useEffect } from 'react';
import '../styles/UserBalance.css';

function UserBalance({ userId }) {
  const [balances, setBalances] = useState({
    usd: 0,
    pendingUsd: 0,
    yesShares: 0,
    noShares: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!userId) return;
    
    const fetchUserBalance = async () => {
      try {
        setIsLoading(true);
        
        // Replace with your actual API endpoint
        const response = await fetch(`/api/users/${userId}/balance`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch balance');
        }
        
        const data = await response.json();
        setBalances({
          usd: data.usd || 0,
          pendingUsd: data.pendingUsd || 0,
          yesShares: data.yesShares || 0,
          noShares: data.noShares || 0
        });
        
      } catch (err) {
        console.error('Error fetching balance:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserBalance();
    
    // Set up polling to keep balance updated
    const intervalId = setInterval(fetchUserBalance, 30000); // Update every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [userId]);
  
  return (
    <div className="user-balance">
      <h3>Your Balance</h3>
      
      {isLoading ? (
        <div className="balance-loading">Loading...</div>
      ) : error ? (
        <div className="balance-error">{error}</div>
      ) : (
        <div className="balance-details">
          <div className="balance-item">
            <span className="balance-label">Available:</span>
            <span className="balance-value">${balances.usd.toFixed(2)}</span>
          </div>
          
          {balances.pendingUsd > 0 && (
            <div className="balance-item">
              <span className="balance-label">Pending:</span>
              <span className="balance-value pending">${balances.pendingUsd.toFixed(2)}</span>
            </div>
          )}
          
          <div className="balance-divider"></div>
          
          {balances.yesShares > 0 && (
            <div className="balance-item">
              <span className="balance-label">YES Shares:</span>
              <span className="balance-value yes">{balances.yesShares}</span>
            </div>
          )}
          
          {balances.noShares > 0 && (
            <div className="balance-item">
              <span className="balance-label">NO Shares:</span>
              <span className="balance-value no">{balances.noShares}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UserBalance;