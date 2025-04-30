import '../styles/BuyButtons.css';

function BuyButtons() {
  const handleBuyYes = () => {
    alert('Buy YES modal will be implemented later');
  };
  
  const handleBuyNo = () => {
    alert('Buy NO modal will be implemented later');
  };
  
  return (
    <div className="buy-buttons">
      <button className="buy-yes" onClick={handleBuyYes}>
        Buy YES
      </button>
      <button className="buy-no" onClick={handleBuyNo}>
        Buy NO
      </button>
    </div>
  );
}

export default BuyButtons;