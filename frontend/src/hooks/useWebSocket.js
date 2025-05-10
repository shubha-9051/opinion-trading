import { useState, useEffect, useCallback, useRef } from 'react';

const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [topics, setTopics] = useState({});
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [yesOrderbook, setYesOrderbook] = useState({ bids: [], asks: [] });
  const [noOrderbook, setNoOrderbook] = useState({ bids: [], asks: [] });
  const [error, setError] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const subscriptionsRef = useRef({ yes: null, no: null });
  const responseListenersRef = useRef({});

  
  // Function to send a message through the WebSocket
  const sendMessage = useCallback((message) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.error('WebSocket is not connected');
      return false;
    }
  }, []);

  // Function to add response listeners
  const addResponseListener = useCallback((type, callback) => {
    if (!responseListenersRef.current[type]) {
      responseListenersRef.current[type] = [];
    }
    responseListenersRef.current[type].push(callback);
  }, []);

  // Function to remove response listeners
  const removeResponseListener = useCallback((type, callback) => {
    if (responseListenersRef.current[type]) {
      responseListenersRef.current[type] = responseListenersRef.current[type].filter(
        cb => cb !== callback
      );
    }
  }, []);

  // Function to connect to WebSocket
  const connect = useCallback(() => {
    // Clean up any existing connection
    if (socketRef.current) {
      socketRef.current.onclose = null; // Remove the onclose handler to prevent recursion
      socketRef.current.close();
    }

    try {
      console.log('Attempting to connect to WebSocket...');
      const socket = new WebSocket('ws://localhost:8080');

      socket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        setReconnectAttempt(0);
        
        // Clear any reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // Request topics list on connection
        socket.send(JSON.stringify({ action: 'get_topics' }));
        
        // Resubscribe to markets if needed
        if (subscriptionsRef.current.yes) {
          socket.send(JSON.stringify({
            action: 'subscribe',
            market: subscriptionsRef.current.yes
          }));
        }
        
        if (subscriptionsRef.current.no) {
          socket.send(JSON.stringify({
            action: 'subscribe',
            market: subscriptionsRef.current.no
          }));
        }
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'orderbook':
              if (message.market.includes('-yes-')) {
                setYesOrderbook(message.data);
              } else if (message.market.includes('-no-')) {
                setNoOrderbook(message.data);
              }
              break;
            
            case 'topics':
              setTopics(message.data);
              
              // If no topic is selected yet, select the first one
              if (!selectedTopic && Object.keys(message.data).length > 0) {
                const firstTopicId = Object.keys(message.data)[0];
                const firstTopic = {
                  id: firstTopicId,
                  ...message.data[firstTopicId]
                };
                console.log('useWebSocket - Setting initial topic:', firstTopic);
                setSelectedTopic(firstTopic);
                
                // Store subscriptions
                subscriptionsRef.current = {
                  yes: `${firstTopicId}-yes-usd`,
                  no: `${firstTopicId}-no-usd`
                };
                
                // Subscribe to markets
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({
                    action: 'subscribe',
                    market: `${firstTopicId}-yes-usd`
                  }));
                  
                  socket.send(JSON.stringify({
                    action: 'subscribe',
                    market: `${firstTopicId}-no-usd`
                  }));
                }
              }
              break;
            
            // Check for order-related responses and notify listeners
            case 'OPEN_ORDERS':
            case 'ORDER_EXECUTED':
            case 'ORDER_PARTIALLY_FILLED':
            case 'ORDER_CANCELED':
            case 'ON_RAMP_SUCCESS':
              // If we have listeners for this message type, call them
              if (responseListenersRef.current[message.type]) {
                responseListenersRef.current[message.type].forEach(callback => {
                  callback(message);
                });
              }
              break;
              
            case 'error':
              console.error('Server error:', message.message);
              setError(message.message);
              break;
            
            default:
              console.log('Unhandled message type:', message.type);
              // Check if there are listeners for this message type
              if (responseListenersRef.current[message.type]) {
                responseListenersRef.current[message.type].forEach(callback => {
                  callback(message);
                });
              }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      socket.onclose = (event) => {
        console.log(`WebSocket disconnected (${event.code})`);
        setIsConnected(false);
        
        // Increment reconnection attempt counter
        setReconnectAttempt(prev => prev + 1);
        
        // Exponential backoff for reconnection (max 30 seconds)
        const delay = Math.min(Math.pow(2, reconnectAttempt) * 1000, 30000);
        
        console.log(`Attempting to reconnect in ${delay/1000} seconds...`);
        
        // Try to reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          if (document.visibilityState !== 'hidden') {
            connect();
          }
        }, delay);
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Connection error. Please check if the WebSocket server is running.');
      };

      socketRef.current = socket;
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setError('Failed to connect to WebSocket server');
      
      // Try to reconnect after delay
      const delay = Math.min(Math.pow(2, reconnectAttempt) * 1000, 30000);
      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectAttempt(prev => prev + 1);
        if (document.visibilityState !== 'hidden') {
          connect();
        }
      }, delay);
    }
  }, [reconnectAttempt]); // Only depend on reconnectAttempt to avoid loops

  const selectTopic = useCallback((topic) => {
    if (!topic) return;
    
    console.log('useWebSocket - selectTopic called with topic:', topic);
    
    // IMPORTANT: Use a function to update the state to ensure we're using the latest state
    setSelectedTopic(prevTopic => {
      console.log('useWebSocket - Previous selected topic:', prevTopic);
      console.log('useWebSocket - Setting new selected topic:', topic);
      return topic;
    });
    
    // Store the new subscription info
    subscriptionsRef.current = {
      yes: `${topic.id}-yes-usd`,
      no: `${topic.id}-no-usd`
    };
    
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      // Reset orderbooks while waiting for new data
      setYesOrderbook({ bids: [], asks: [] });
      setNoOrderbook({ bids: [], asks: [] });
      
      socketRef.current.send(JSON.stringify({
        action: 'subscribe',
        market: `${topic.id}-yes-usd`
      }));
      
      socketRef.current.send(JSON.stringify({
        action: 'subscribe',
        market: `${topic.id}-no-usd`
      }));
    }
  }, []); // Keep the dependency array empty to avoid re-creating this function

  // Add a debugging effect to log when selectedTopic changes
  useEffect(() => {
    console.log('useWebSocket - selectedTopic state changed to:', selectedTopic);
  }, [selectedTopic]);

  // Connect on mount and handle visibility changes
  useEffect(() => {
    connect();
    
    // Handle page visibility changes to reconnect when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          socketRef.current?.readyState !== WebSocket.OPEN &&
          !reconnectTimeoutRef.current) {
        connect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (socketRef.current) {
        // Remove the onclose handler to prevent it from triggering during unmount
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    topics,
    selectedTopic,
    yesOrderbook,
    noOrderbook,
    error,
    selectTopic,
    reconnectAttempt,
    // Add the new methods
    sendMessage,
    addResponseListener,
    removeResponseListener,
    // Expose the socket for direct usage if needed (though better to use the methods above)
    socket: socketRef.current
  };
};

export default useWebSocket;