import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

// Backend API URLs
const API_BASE_URL = 'http://localhost:3000';
const SIGNIN_URL = `${API_BASE_URL}/signin`;
const SIGNUP_URL = `${API_BASE_URL}/signup`;

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check if user is already logged in from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);
  
  const login = async (username, password) => {
    try {
      console.log('Attempting login with backend at:', SIGNIN_URL);
      
      const response = await fetch(SIGNIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Login failed (${response.status})`);
      }
      
      const userData = await response.json();
      
      const user = {
        id: userData.userId,
        username: userData.username,
        email: userData.email,
        balance: userData.balance,
        token: userData.token
      };
      
      // Store user data in localStorage and state
      localStorage.setItem('user', JSON.stringify(user));
      setCurrentUser(user);
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };
  
  const signup = async (username, password, email) => {
    try {
      console.log('Attempting signup with backend at:', SIGNUP_URL);
      
      const response = await fetch(SIGNUP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username,
          password,
          email
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Signup failed (${response.status})`);
      }
      
      const userData = await response.json();
      
      const user = {
        id: userData.userId,
        username: userData.username,
        email: userData.email,
        balance: userData.balance,
        token: userData.token
      };
      
      // Store user after signup instead of auto-login
      localStorage.setItem('user', JSON.stringify(user));
      setCurrentUser(user);
      return user;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };
  
  const logout = () => {
    // Clear user data
    localStorage.removeItem('user');
    setCurrentUser(null);
  };
  
  // Helper function to get user balance
  const getUserBalance = () => {
    if (currentUser && currentUser.balance) {
      return parseFloat(currentUser.balance);
    }
    return 0;
  };

  // Helper to update user data in state and storage
  const updateUserData = (newData) => {
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        ...newData
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
    }
  };
  
  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      login, 
      signup, 
      logout,
      isAuthenticated: !!currentUser,
      loading,
      getUserBalance,
      updateUserData
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);