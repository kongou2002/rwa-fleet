// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {AuditRegistry} from "../src/AuditRegistry.sol";

contract AuditRegistryTest is Test {
    AuditRegistry reg;
    address auditor = makeAddr("auditor");
    address operator = makeAddr("rental operator");
    bytes32 constant HASH = keccak256("2026-Q3 fleet audit report.pdf");

    event ReportPublished(
        uint256 indexed id, uint256 indexed carId, string period, string scope, bool exceptions, bytes32 reportHash
    );

    function setUp() public {
        vm.warp(1_800_000_000);
        reg = new AuditRegistry(auditor);
    }

    function test_constructor() public {
        assertEq(reg.auditor(), auditor);
        assertEq(reg.reportCount(), 0);
        vm.expectRevert(AuditRegistry.NotAuditor.selector);
        new AuditRegistry(address(0));
    }

    function test_publish_storesAndEmits() public {
        vm.expectEmit(address(reg));
        emit ReportPublished(1, 0, "2026-Q3", "cars, rental income, payouts", false, HASH);
        vm.prank(auditor);
        uint256 id = reg.publish(0, "2026-Q3", "cars, rental income, payouts", false, HASH);

        assertEq(id, 1);
        assertEq(reg.reportCount(), 1);
        AuditRegistry.Report memory r = reg.getReport(1);
        assertEq(r.carId, 0);
        assertEq(r.period, "2026-Q3");
        assertEq(r.scope, "cars, rental income, payouts");
        assertFalse(r.exceptions);
        assertEq(r.reportHash, HASH);
        assertEq(r.publishedAt, block.timestamp);
    }

    function test_publish_perCarWithExceptions_appendOnly() public {
        vm.startPrank(auditor);
        reg.publish(0, "2026-Q2", "fleet", false, HASH);
        vm.warp(block.timestamp + 90 days);
        uint256 id = reg.publish(1, "2026-Q3", "car 1 odometer", true, keccak256("car1"));
        vm.stopPrank();

        assertEq(id, 2);
        assertEq(reg.reportCount(), 2);
        AuditRegistry.Report memory first = reg.getReport(1);
        AuditRegistry.Report memory second = reg.getReport(2);
        assertEq(first.period, "2026-Q2", "earlier report unchanged");
        assertEq(first.reportHash, HASH);
        assertEq(second.carId, 1);
        assertTrue(second.exceptions);
        assertEq(second.publishedAt, block.timestamp);
        assertGt(second.publishedAt, first.publishedAt);
    }

    function test_publish_emptyScopeAllowed() public {
        vm.prank(auditor);
        reg.publish(2, "2026-Q3", "", false, HASH);
        assertEq(reg.getReport(1).scope, "");
    }

    function test_publish_onlyAuditor() public {
        vm.prank(operator);
        vm.expectRevert(AuditRegistry.NotAuditor.selector);
        reg.publish(0, "2026-Q3", "fleet", false, HASH);
    }

    function test_publish_needsHash() public {
        vm.prank(auditor);
        vm.expectRevert(AuditRegistry.BadReport.selector);
        reg.publish(0, "2026-Q3", "fleet", false, bytes32(0));
    }

    function test_publish_needsPeriod() public {
        vm.prank(auditor);
        vm.expectRevert(AuditRegistry.BadReport.selector);
        reg.publish(0, "", "fleet", false, HASH);
    }

    function test_getReport_outOfRange() public {
        vm.expectRevert(AuditRegistry.BadReport.selector);
        reg.getReport(0);
        vm.expectRevert(AuditRegistry.BadReport.selector);
        reg.getReport(1);
        vm.prank(auditor);
        reg.publish(0, "2026-Q3", "fleet", false, HASH);
        reg.getReport(1);
        vm.expectRevert(AuditRegistry.BadReport.selector);
        reg.getReport(2);
    }
}
