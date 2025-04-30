import '../styles/TopicDisplay.css';

function TopicDisplay({ topic }) {
  return (
    <div className="topic-display">
      <h1>{topic.name}</h1>
    </div>
  );
}

export default TopicDisplay;