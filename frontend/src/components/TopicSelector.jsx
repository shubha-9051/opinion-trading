import { useWebSocketContext } from "../context/useWebSocketContext";
import "../styles/TopicSelector.css";

function TopicSelector() {
  const { topics, selectedTopic, selectTopic } = useWebSocketContext();

  if (!topics || Object.keys(topics).length === 0) return null;

  return (
    <div className="topic-selector">
      <select
        className="topic-selector-select"
        value={selectedTopic?.id || ""}
        onChange={e => {
          const topicId = e.target.value;
          if (topicId && topics[topicId]) {
            selectTopic({ id: topicId, ...topics[topicId] });
          }
        }}
      >
        {Object.entries(topics).map(([id, topic]) => (
          <option key={id} value={id}>{topic.name}</option>
        ))}
      </select>
    </div>
  );
}

export default TopicSelector;