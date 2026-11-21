// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FleetShares} from "../FleetShares.sol";
import {ITeleporterReceiver} from "./ITeleporter.sol";

/// @title IncomeMirror: what the operator reported on its L1, next to what it paid on the C-Chain.
/// @notice Receives each car's period totals from RentalLog over ICM. `ledger` puts the reported income beside the
///         rent paid into FleetShares, so a shareholder sees at once whether the operator is paying what it earns.
///         It accepts a message only from Teleporter, only from the configured L1 and only from the configured
///         RentalLog, and each period once.
contract IncomeMirror is ITeleporterReceiver {
    struct Reported {
        uint32 periods;
        uint32 rentals;
        uint32 daysRented;
        uint256 income;
    }

    address public immutable teleporter;
    bytes32 public immutable sourceBlockchainID;
    address public immutable rentalLog;
    FleetShares public immutable fleet;

    mapping(uint256 => Reported) public reported;
    mapping(uint256 => mapping(uint32 => bool)) public seen;

    event IncomeReported(uint256 indexed carId, uint32 period, uint32 rentals, uint32 daysRented, uint256 income);

    error NotTeleporter();
    error WrongSource();
    error Duplicate();

    constructor(address teleporter_, bytes32 sourceBlockchainID_, address rentalLog_, FleetShares fleet_) {
        teleporter = teleporter_;
        sourceBlockchainID = sourceBlockchainID_;
        rentalLog = rentalLog_;
        fleet = fleet_;
    }

    function receiveTeleporterMessage(bytes32 sourceBlockchainID_, address originSenderAddress, bytes calldata message)
        external
    {
        if (msg.sender != teleporter) revert NotTeleporter();
        if (sourceBlockchainID_ != sourceBlockchainID || originSenderAddress != rentalLog) revert WrongSource();
        (uint256 carId, uint32 period, uint32 rentals, uint32 daysRented, uint256 income) =
            abi.decode(message, (uint256, uint32, uint32, uint32, uint256));
        if (seen[carId][period]) revert Duplicate();
        seen[carId][period] = true;
        Reported storage r = reported[carId];
        r.periods += 1;
        r.rentals += rentals;
        r.daysRented += daysRented;
        r.income += income;
        emit IncomeReported(carId, period, rentals, daysRented, income);
    }

    /// @notice Income reported on the L1, rent paid into FleetShares, and the part reported but not yet paid.
    function ledger(uint256 carId) external view returns (uint256 reportedIncome, uint256 rentPaid, uint256 unpaid) {
        reportedIncome = reported[carId].income;
        rentPaid = fleet.getCar(carId).rentPaid;
        unpaid = reportedIncome > rentPaid ? reportedIncome - rentPaid : 0;
    }
}
