import '../styles/TopicDetails.css';

function TopicDetails({ topic }) {
  // Format the expiration date
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="topic-details">
      <div className="detail-item">
        <h3>Description</h3>
        <p>{topic.description}</p>
      </div>
      
      <div className="detail-item">
        <h3>Expiration Date</h3>
        <p>{formatDate(topic.expiresAt)}</p>
      </div>
    </div>
  );
}

export default TopicDetails;