// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ITeleporterMessenger, ITeleporterReceiver, TeleporterMessageInput} from "../../src/icm/ITeleporter.sol";

/// Stands in for TeleporterMessenger on one chain. A message sent here waits in a queue until the test delivers it,
/// the way the relayer would. Delivery runs through the peer messenger (the destination chain's TeleporterMessenger),
/// so the receiver sees its own chain's messenger as `msg.sender` and this chain's ID as the source, as on a real
/// network. A receiver's revert is passed up so a test sees it.
contract QueuedTeleporter is ITeleporterMessenger {
    struct Pending {
        address sender;
        address destination;
        uint256 gasLimit;
        bytes message;
        bool delivered;
    }

    bytes32 public immutable chainID;
    QueuedTeleporter public peer;
    Pending[] public queue;

    constructor(bytes32 chainID_) {
        chainID = chainID_;
    }

    function setPeer(QueuedTeleporter peer_) external {
        peer = peer_;
    }

    function sendCrossChainMessage(TeleporterMessageInput calldata m) external returns (bytes32 id) {
        queue.push(Pending(msg.sender, m.destinationAddress, m.requiredGasLimit, m.message, false));
        id = keccak256(abi.encode(chainID, queue.length));
    }

    function count() external view returns (uint256) {
        return queue.length;
    }

    function deliver(uint256 i) public {
        Pending storage p = queue[i];
        require(!p.delivered, "delivered");
        p.delivered = true;
        peer.execute(chainID, p.sender, p.destination, p.gasLimit, p.message);
    }

    function deliverLast() external {
        deliver(queue.length - 1);
    }

    /// Called by the peer: runs a message that arrived on this chain.
    function execute(bytes32 source, address sender, address destination, uint256 gasLimit, bytes calldata message)
        external
    {
        require(msg.sender == address(peer), "not peer");
        ITeleporterReceiver(destination).receiveTeleporterMessage{gas: gasLimit}(source, sender, message);
    }
}
