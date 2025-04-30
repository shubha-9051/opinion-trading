import { useState } from 'react';
import '../styles/TopicSelector.css';

function TopicSelector({ topics, selectedTopic, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleSelectTopic = (topicId) => {
    const topic = {
      id: topicId,
      ...topics[topicId]
    };
    onSelect(topic);
    setIsOpen(false);
  };
  
  return (
    <div className="topic-selector">
      <div className="selector-button" onClick={() => setIsOpen(!isOpen)}>
        <span>{selectedTopic?.name || "Select Topic"}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>
      
      {isOpen && (
        <div className="dropdown-menu">
          {Object.entries(topics).map(([id, topic]) => (
            <div 
              key={id}
              className={`topic-item ${selectedTopic?.id === id ? 'selected' : ''}`}
              onClick={() => handleSelectTopic(id)}
            >
              {topic.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TopicSelector;