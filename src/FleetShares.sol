// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FleetShares: fractional shares of rental cars, with rent paid out per share.
/// @notice The manager lists a car as a fixed number of shares at a fixed price. Investors buy shares with USDC.
///         When every share is sold the purchase money goes to the rental operator, who buys and rents out the car;
///         if the deadline passes first, every buyer takes their money back. The operator pays rent in per car:
///         10 % goes to the manager as its fee, 90 % to the car's shareholders pro rata. Shares of a funded car can
///         be traded through the built-in offer book, and unclaimed rent stays with whoever earned it.
/// @dev One ERC-1155 id per car. The chain cannot see the car or its real income: it records who reported what and
///      enforces how the money is split.
contract FleetShares is ERC1155, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Funding, // shares on sale
        Active, // fully funded: operator paid, rent flows, shares tradable
        Cancelled // deadline passed before full funding: buyers refund
    }

    struct Car {
        string name;
        string imageURI;
        bytes32 docsHash; // keccak256 of the registration and rental agreement
        address operator; // rental company that receives the purchase money and pays rent
        uint64 fundingDeadline;
        uint32 totalShares;
        uint32 sold;
        Status status;
        uint256 sharePrice; // payment token units per share
        uint256 rentPaid; // gross rent paid in by the operator
        uint256 feePaid; // the manager's cut of that rent
        uint256 accPerShare; // net rent per share so far, scaled by 1e18
    }

    struct Offer {
        address seller;
        uint256 carId;
        uint32 amount; // shares still on offer
        uint256 pricePerShare;
    }

    /// @notice The manager's fee: 10 % of every rent payment.
    uint256 public constant FEE_BPS = 1_000;
    uint256 private constant ACC = 1e18;

    IERC20 public immutable token;
    /// @notice The company that lists cars and earns the fee. It never holds investors' money.
    address public immutable manager;

    uint256 public carCount;
    uint256 public offerCount;
    uint256 public feesOwed;
    mapping(uint256 => Car) private _cars;
    mapping(uint256 => Offer) private _offers;
    mapping(uint256 => mapping(address => uint256)) private _accPaid;
    mapping(uint256 => mapping(address => uint256)) private _owed;

    event CarListed(
        uint256 indexed carId,
        string name,
        address indexed operator,
        uint32 totalShares,
        uint256 sharePrice,
        uint64 fundingDeadline
    );
    event SharesBought(uint256 indexed carId, address indexed buyer, uint32 amount, uint256 paid);
    event CarFunded(uint256 indexed carId, address indexed operator, uint256 paidToOperator);
    event FundingCancelled(uint256 indexed carId);
    event Refunded(uint256 indexed carId, address indexed buyer, uint256 amount);
    event RentPaid(uint256 indexed carId, address indexed payer, uint256 gross, uint256 fee, uint256 toHolders);
    event RentClaimed(uint256 indexed carId, address indexed holder, uint256 amount);
    event FeesWithdrawn(uint256 amount);
    event OfferMade(
        uint256 indexed offerId, uint256 indexed carId, address indexed seller, uint32 amount, uint256 pricePerShare
    );
    event OfferTaken(uint256 indexed offerId, address indexed buyer, uint32 amount, uint256 paid);
    event OfferCancelled(uint256 indexed offerId);

    error NotManager();
    error NotOperator();
    error BadCar();
    error WrongStatus();
    error FundingClosed();
    error FundingOpen();
    error NotEnoughShares();
    error ZeroAmount();
    error NothingToClaim();
    error NotSeller();
    error TransfersLocked();

    constructor(IERC20 token_, address manager_) ERC1155("") {
        token = token_;
        manager = manager_;
    }

    // ---------- listing and funding ----------

    function listCar(
        string calldata name,
        string calldata imageURI,
        bytes32 docsHash,
        address operator,
        uint32 totalShares,
        uint256 sharePrice,
        uint64 fundingDuration
    ) external returns (uint256 carId) {
        if (msg.sender != manager) revert NotManager();
        if (operator == address(0) || totalShares == 0 || sharePrice == 0 || fundingDuration == 0) revert BadCar();
        carId = ++carCount;
        Car storage c = _cars[carId];
        c.name = name;
        c.imageURI = imageURI;
        c.docsHash = docsHash;
        c.operator = operator;
        c.totalShares = totalShares;
        c.sharePrice = sharePrice;
        c.fundingDeadline = uint64(block.timestamp) + fundingDuration;
        c.status = Status.Funding;
        emit CarListed(carId, name, operator, totalShares, sharePrice, c.fundingDeadline);
    }

    /// @notice Buys shares of a car on sale. The sale that sells the last share pays the operator.
    function buyShares(uint256 carId, uint32 amount) external nonReentrant {
        Car storage c = _cars[carId];
        if (c.status != Status.Funding) revert WrongStatus();
        if (block.timestamp > c.fundingDeadline) revert FundingClosed();
        if (amount == 0) revert ZeroAmount();
        if (amount > c.totalShares - c.sold) revert NotEnoughShares();

        uint256 cost = uint256(amount) * c.sharePrice;
        c.sold += amount;
        bool funded = c.sold == c.totalShares;
        if (funded) c.status = Status.Active;
        token.safeTransferFrom(msg.sender, address(this), cost);
        _mint(msg.sender, carId, amount, "");
        emit SharesBought(carId, msg.sender, amount, cost);

        if (funded) {
            uint256 total = uint256(c.totalShares) * c.sharePrice;
            token.safeTransfer(c.operator, total);
            emit CarFunded(carId, c.operator, total);
        }
    }

    /// @notice After the deadline, closes a sale that did not sell out, so buyers can refund.
    function cancelFunding(uint256 carId) external {
        Car storage c = _cars[carId];
        if (c.status != Status.Funding) revert WrongStatus();
        if (block.timestamp <= c.fundingDeadline) revert FundingOpen();
        c.status = Status.Cancelled;
        emit FundingCancelled(carId);
    }

    /// @notice Returns the caller's money for a cancelled sale and burns their shares.
    function refund(uint256 carId) external nonReentrant {
        Car storage c = _cars[carId];
        if (c.status != Status.Cancelled) revert WrongStatus();
        uint256 shares = balanceOf(msg.sender, carId);
        if (shares == 0) revert NothingToClaim();
        _burn(msg.sender, carId, shares);
        uint256 amount = shares * c.sharePrice;
        token.safeTransfer(msg.sender, amount);
        emit Refunded(carId, msg.sender, amount);
    }

    // ---------- rent ----------

    /// @notice The operator pays a car's rent in: 10 % to the manager, the rest to the car's shareholders.
    function payRent(uint256 carId, uint256 amount) external nonReentrant {
        Car storage c = _cars[carId];
        if (c.status != Status.Active) revert WrongStatus();
        if (msg.sender != c.operator) revert NotOperator();
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 fee = amount * FEE_BPS / 10_000;
        uint256 toHolders = amount - fee;
        c.rentPaid += amount;
        c.feePaid += fee;
        feesOwed += fee;
        c.accPerShare += toHolders * ACC / c.totalShares;
        emit RentPaid(carId, msg.sender, amount, fee, toHolders);
    }

    function claim(uint256 carId) external nonReentrant returns (uint256 amount) {
        _settle(carId, msg.sender);
        amount = _owed[carId][msg.sender];
        if (amount == 0) revert NothingToClaim();
        _owed[carId][msg.sender] = 0;
        token.safeTransfer(msg.sender, amount);
        emit RentClaimed(carId, msg.sender, amount);
    }

    function withdrawFees() external nonReentrant {
        uint256 amount = feesOwed;
        if (amount == 0) revert NothingToClaim();
        feesOwed = 0;
        token.safeTransfer(manager, amount);
        emit FeesWithdrawn(amount);
    }

    // ---------- secondary market ----------

    /// @notice Offers shares of a funded car at a price. The shares stay with the seller, and keep earning rent for
    ///         the seller, until someone takes the offer.
    function makeOffer(uint256 carId, uint32 amount, uint256 pricePerShare) external returns (uint256 offerId) {
        if (_cars[carId].status != Status.Active) revert WrongStatus();
        if (amount == 0 || pricePerShare == 0) revert ZeroAmount();
        if (balanceOf(msg.sender, carId) < amount) revert NotEnoughShares();
        offerId = ++offerCount;
        _offers[offerId] = Offer(msg.sender, carId, amount, pricePerShare);
        emit OfferMade(offerId, carId, msg.sender, amount, pricePerShare);
    }

    function cancelOffer(uint256 offerId) external {
        Offer storage o = _offers[offerId];
        if (o.seller != msg.sender) revert NotSeller();
        o.amount = 0;
        emit OfferCancelled(offerId);
    }

    /// @notice Buys `amount` shares from an offer: the payment goes to the seller, the shares to the caller.
    function takeOffer(uint256 offerId, uint32 amount) external nonReentrant {
        Offer storage o = _offers[offerId];
        if (amount == 0) revert ZeroAmount();
        if (amount > o.amount || balanceOf(o.seller, o.carId) < amount) revert NotEnoughShares();
        o.amount -= amount;
        uint256 cost = uint256(amount) * o.pricePerShare;
        token.safeTransferFrom(msg.sender, o.seller, cost);
        _safeTransferFrom(o.seller, msg.sender, o.carId, amount, "");
        emit OfferTaken(offerId, msg.sender, amount, cost);
    }

    // ---------- views ----------

    function getCar(uint256 carId) external view returns (Car memory) {
        return _cars[carId];
    }

    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return _offers[offerId];
    }

    /// @notice Rent `holder` can claim for a car now.
    function claimable(uint256 carId, address holder) external view returns (uint256) {
        return
            _owed[carId][holder] + balanceOf(holder, carId) * (_cars[carId].accPerShare - _accPaid[carId][holder]) / ACC;
    }

    function uri(uint256 carId) public view override returns (string memory) {
        return _cars[carId].imageURI;
    }

    // ---------- accounting on every balance change ----------

    function _settle(uint256 carId, address holder) private {
        uint256 acc = _cars[carId].accPerShare;
        uint256 paid = _accPaid[carId][holder];
        if (acc != paid) {
            _owed[carId][holder] += balanceOf(holder, carId) * (acc - paid) / ACC;
            _accPaid[carId][holder] = acc;
        }
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 carId = ids[i];
            if (from != address(0) && to != address(0) && _cars[carId].status != Status.Active) {
                revert TransfersLocked();
            }
            if (from != address(0)) _settle(carId, from);
            if (to != address(0)) _settle(carId, to);
        }
        super._update(from, to, ids, values);
    }
}
