// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {FleetShares} from "./FleetShares.sol";

/// @title CarExit: pays a car's resale money out to its shareholders.
/// @notice At the end of a car's rental life the operator sells it and calls `settle` with the sale money. From then
///         on every holder can `redeem` shares of that car for `proceeds * shares / totalShares` USDC. No management
///         fee is taken on resale: the 10 % fee in FleetShares applies to rent only.
/// @dev Add-on next to an already deployed FleetShares, which cannot be changed. Consequences:
///      - FleetShares has no "sold" status, so after `settle` the car stays Active there. Shares keep trading on the
///        offer book, and the operator could still call `payRent`. Rent paid after the sale is split over all
///        `totalShares`, including the shares already redeemed and locked in this contract; that part is credited to
///        this contract in FleetShares and nobody claims it. Operators should stop paying rent once a car is sold.
///      - Rent a holder earned before redeeming is not lost: moving shares triggers FleetShares' transfer hook, which
///        books the holder's pending rent to them; they claim it from FleetShares as usual.
///      - Rounding: each payout is rounded down; the redemption that takes the last outstanding share receives
///        `proceeds - paidOut`, so once every share is redeemed the contract has paid out exactly `proceeds`. Until
///        then the dust (less than one USDC unit per redemption) stays in this contract.
///      - Redeemed shares stay here forever; this contract never moves them out.
contract CarExit is IERC1155Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Exit {
        uint256 proceeds; // USDC paid in by the operator for the sale
        uint256 paidOut; // USDC paid to redeeming holders so far
        uint32 totalShares; // snapshot of the car's share count at settle
        uint32 redeemedShares; // shares handed in so far
        uint64 soldAt; // settle timestamp, 0 = not sold
    }

    FleetShares public immutable fleet;
    IERC20 public immutable token;

    mapping(uint256 => Exit) private _exits;

    event CarSold(uint256 indexed carId, address indexed operator, uint256 proceeds);
    event Redeemed(uint256 indexed carId, address indexed holder, uint32 shares, uint256 paid);

    error NotOperator();
    error WrongStatus();
    error AlreadySold();
    error NotSold();
    error ZeroAmount();
    error NotEnoughShares();
    error UnexpectedTransfer();

    constructor(FleetShares fleet_) {
        fleet = fleet_;
        token = fleet_.token();
    }

    /// @notice The car's operator pays in the resale money, once, while the car is Active in FleetShares.
    function settle(uint256 carId, uint256 proceeds) external nonReentrant {
        if (proceeds == 0) revert ZeroAmount();
        FleetShares.Car memory c = fleet.getCar(carId);
        if (msg.sender != c.operator) revert NotOperator();
        if (c.status != FleetShares.Status.Active) revert WrongStatus();
        Exit storage e = _exits[carId];
        if (e.soldAt != 0) revert AlreadySold();
        e.proceeds = proceeds;
        e.totalShares = c.totalShares;
        e.soldAt = uint64(block.timestamp);
        token.safeTransferFrom(msg.sender, address(this), proceeds);
        emit CarSold(carId, msg.sender, proceeds);
    }

    /// @notice Hands `shares` of a sold car to this contract for their part of the sale money.
    ///         Needs `fleet.setApprovalForAll(address(this), true)` first.
    function redeem(uint256 carId, uint32 shares) external nonReentrant returns (uint256 paid) {
        Exit storage e = _exits[carId];
        if (e.soldAt == 0) revert NotSold();
        if (shares == 0) revert ZeroAmount();
        if (fleet.balanceOf(msg.sender, carId) < shares) revert NotEnoughShares();

        uint32 redeemed = e.redeemedShares + shares;
        paid = redeemed == e.totalShares
            ? e.proceeds - e.paidOut
            : Math.mulDiv(e.proceeds, shares, e.totalShares);
        e.redeemedShares = redeemed;
        e.paidOut += paid;

        fleet.safeTransferFrom(msg.sender, address(this), carId, shares, "");
        token.safeTransfer(msg.sender, paid);
        emit Redeemed(carId, msg.sender, shares, paid);
    }

    // ---------- views ----------

    function exitOf(uint256 carId) external view returns (Exit memory) {
        return _exits[carId];
    }

    /// @notice USDC `holder` would receive for redeeming their whole current balance now (0 before `settle`).
    function redeemable(uint256 carId, address holder) external view returns (uint256) {
        Exit storage e = _exits[carId];
        if (e.soldAt == 0) return 0;
        uint256 shares = fleet.balanceOf(holder, carId);
        if (shares == 0) return 0;
        if (e.redeemedShares + shares == e.totalShares) return e.proceeds - e.paidOut;
        return Math.mulDiv(e.proceeds, shares, e.totalShares);
    }

    // ---------- ERC-1155 receiver: only FleetShares tokens pulled by `redeem` ----------

    function onERC1155Received(address operator, address, uint256, uint256, bytes calldata)
        external
        view
        returns (bytes4)
    {
        if (msg.sender != address(fleet) || operator != address(this)) revert UnexpectedTransfer();
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert UnexpectedTransfer();
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
