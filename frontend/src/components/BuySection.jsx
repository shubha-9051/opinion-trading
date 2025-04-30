import { useState } from "react";
import BuyModal from "./BuyModal";
import UserBalance from "./UserBalance";
import { useWebSocketContext } from "../context/useWebSocketContext";
import "../styles/BuySection.css"; // ensure correct path

function BuySection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [shareType, setShareType] = useState(null);
  const [balanceUpdate, setBalanceUpdate] = useState(null);

  const { selectedTopic, yesOrderbook, noOrderbook, isConnected } = useWebSocketContext();

  if (!isConnected || !selectedTopic) return <div>Loading...</div>;

  return (
    <>
      <UserBalance balanceUpdate={balanceUpdate} />
      <div className="buy-buttons">
        <button
          className="buy-yes"
          onClick={() => { setShareType("yes"); setModalOpen(true); }}
        >
          Buy YES
        </button>
        <button
          className="buy-no"
          onClick={() => { setShareType("no"); setModalOpen(true); }}
        >
          Buy NO
        </button>
      </div>
      <BuyModal
        key={selectedTopic.id}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        topicId={selectedTopic.id}
        initialShareType={shareType}
        topicQuestion={selectedTopic.name}
        yesOrderbook={yesOrderbook}
        noOrderbook={noOrderbook}
        onOrderResponse={res => res?.data?.userBalance && setBalanceUpdate(res.data.userBalance)}
      />
    </>
  );
}

export default BuySection;