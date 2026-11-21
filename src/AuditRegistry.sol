// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title AuditRegistry: an independent auditor's reports, published on chain.
/// @notice Each quarter an auditor outside the operator's country checks the cars, the rental income and the payouts,
///         and publishes the hash of the signed report here. Reports are append-only: none can be edited or deleted.
/// @dev The chain stores only the hash and a short summary; the report itself lives off chain. Anyone can recompute
///      keccak256 of the published file and compare. The auditor key is fixed at deployment.
contract AuditRegistry {
    struct Report {
        uint256 carId; // 0 = whole fleet
        string period; // e.g. "2026-Q3"
        string scope; // e.g. "cars, rental income, payouts"
        bool exceptions; // true if the auditor found exceptions
        bytes32 reportHash; // keccak256 of the signed report file
        uint64 publishedAt;
    }

    address public immutable auditor;

    Report[] private _reports;

    event ReportPublished(
        uint256 indexed id, uint256 indexed carId, string period, string scope, bool exceptions, bytes32 reportHash
    );

    error NotAuditor();
    error BadReport();

    constructor(address auditor_) {
        if (auditor_ == address(0)) revert NotAuditor();
        auditor = auditor_;
    }

    /// @notice Publishes a report. Ids start at 1.
    function publish(uint256 carId, string calldata period, string calldata scope, bool exceptions, bytes32 reportHash)
        external
        returns (uint256 id)
    {
        if (msg.sender != auditor) revert NotAuditor();
        if (reportHash == bytes32(0) || bytes(period).length == 0) revert BadReport();
        _reports.push(Report(carId, period, scope, exceptions, reportHash, uint64(block.timestamp)));
        id = _reports.length;
        emit ReportPublished(id, carId, period, scope, exceptions, reportHash);
    }

    function reportCount() external view returns (uint256) {
        return _reports.length;
    }

    function getReport(uint256 id) external view returns (Report memory) {
        if (id == 0 || id > _reports.length) revert BadReport();
        return _reports[id - 1];
    }
}
