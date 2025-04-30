import { useState, useEffect } from 'react';
import '../styles/UserBalance.css';
import { useAuth } from '../context/AuthContext';

function UserBalance({ balanceUpdate }) {
  const { currentUser } = useAuth();
  const [usdBalance, setUsdBalance] = useState(0);

  // Debug logging - useful for troubleshooting
  useEffect(() => {
    console.log("UserBalance component - current balanceUpdate:", balanceUpdate);
  }, [balanceUpdate]);

  // Update balance from order response
  useEffect(() => {
    if (balanceUpdate && balanceUpdate.userId === currentUser?.username) {
      console.log("Updating balance from order response:", balanceUpdate);
      if (balanceUpdate.balances && balanceUpdate.balances.USD !== undefined) {
        setUsdBalance(parseFloat(balanceUpdate.balances.USD));
      }
    }
  }, [balanceUpdate, currentUser]);

  // Initialize from auth context
  useEffect(() => {
    if (currentUser && currentUser.balance) {
      console.log("Initializing balance from user context:", currentUser.balance);
      setUsdBalance(parseFloat(currentUser.balance));
    }
  }, [currentUser]);
  
  return (
    <div className="user-balance-container">
      <div className="balance-header">Your Balance</div>
      <div className="balance-amount">${usdBalance.toFixed(2)}</div>
    </div>
  );
}

export default UserBalance;