// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ITeleporterMessenger, TeleporterMessageInput, TeleporterFeeInfo} from "./ITeleporter.sol";

/// @title RentalLog: the rental operator's day-to-day ledger, on an Avalanche L1.
/// @notice The operator records every rental of a car here (cheap, high volume). Anyone can then close the car's
///         current period: the totals go to IncomeMirror on the C-Chain over ICM, where shareholders compare the
///         income the operator reported with the rent it actually paid into FleetShares.
/// @dev The caller of `report` cannot choose what is sent: the contract sends its own totals, once per period.
contract RentalLog {
    struct Period {
        uint32 rentals;
        uint32 daysRented;
        uint256 income; // payment token units (USDC, 6 decimals)
    }

    uint256 public constant RECEIVE_GAS = 150_000;

    address public immutable manager;
    ITeleporterMessenger public immutable teleporter;
    /// @notice The C-Chain's blockchain ID and IncomeMirror's address there.
    bytes32 public immutable destinationBlockchainID;
    address public immutable mirror;

    mapping(uint256 => address) public operatorOf;
    mapping(uint256 => uint32) public periodOf;
    mapping(uint256 => Period) private _open;
    mapping(bytes32 => bool) public logged;

    event OperatorSet(uint256 indexed carId, address indexed operator);
    event RentalLogged(uint256 indexed carId, bytes32 indexed rentalRef, uint32 daysRented, uint256 income);
    event PeriodReported(
        uint256 indexed carId, uint32 period, uint32 rentals, uint32 daysRented, uint256 income, bytes32 messageID
    );

    error NotManager();
    error NotOperator();
    error BadRental();
    error AlreadyLogged();
    error NothingToReport();

    constructor(address manager_, ITeleporterMessenger teleporter_, bytes32 destinationBlockchainID_, address mirror_) {
        manager = manager_;
        teleporter = teleporter_;
        destinationBlockchainID = destinationBlockchainID_;
        mirror = mirror_;
    }

    function setOperator(uint256 carId, address operator) external {
        if (msg.sender != manager) revert NotManager();
        operatorOf[carId] = operator;
        emit OperatorSet(carId, operator);
    }

    /// @param rentalRef keccak256 of the rental contract; each one can be logged once.
    function logRental(uint256 carId, bytes32 rentalRef, uint32 daysRented, uint256 income) external {
        if (msg.sender != operatorOf[carId]) revert NotOperator();
        if (daysRented == 0 || income == 0) revert BadRental();
        if (logged[rentalRef]) revert AlreadyLogged();
        logged[rentalRef] = true;
        Period storage p = _open[carId];
        p.rentals += 1;
        p.daysRented += daysRented;
        p.income += income;
        emit RentalLogged(carId, rentalRef, daysRented, income);
    }

    /// @notice Closes the car's open period and sends its totals to the C-Chain.
    function report(uint256 carId) external returns (bytes32 messageID) {
        Period memory p = _open[carId];
        if (p.rentals == 0) revert NothingToReport();
        delete _open[carId];
        uint32 period = ++periodOf[carId];
        messageID = teleporter.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: destinationBlockchainID,
                destinationAddress: mirror,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: RECEIVE_GAS,
                allowedRelayerAddresses: new address[](0),
                message: abi.encode(carId, period, p.rentals, p.daysRented, p.income)
            })
        );
        emit PeriodReported(carId, period, p.rentals, p.daysRented, p.income, messageID);
    }

    function openPeriod(uint256 carId) external view returns (Period memory) {
        return _open[carId];
    }
}
