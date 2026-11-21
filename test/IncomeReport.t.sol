// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {FleetShares} from "../src/FleetShares.sol";
import {RentalLog} from "../src/icm/RentalLog.sol";
import {IncomeMirror} from "../src/icm/IncomeMirror.sol";
import {QueuedTeleporter} from "./mocks/QueuedTeleporter.sol";

/// Both chains in one EVM: RentalLog on the L1, FleetShares and IncomeMirror on the C-Chain.
contract IncomeReportTest is Test {
    bytes32 constant C_CHAIN = keccak256("fuji c-chain");
    bytes32 constant L1 = keccak256("operator l1");

    MockUSDC usdc;
    FleetShares fleet;
    RentalLog rlog;
    IncomeMirror mirror;
    QueuedTeleporter l1Tp;
    QueuedTeleporter cTp;
    address manager = makeAddr("manager");
    address operator = makeAddr("operator");
    address investor = makeAddr("investor");
    uint256 car;

    function setUp() public {
        vm.warp(1_800_000_000);
        l1Tp = new QueuedTeleporter(L1);
        cTp = new QueuedTeleporter(C_CHAIN);
        l1Tp.setPeer(cTp);
        cTp.setPeer(l1Tp);
        usdc = new MockUSDC();
        fleet = new FleetShares(usdc, manager);

        address mirrorAt = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        rlog = new RentalLog(manager, l1Tp, C_CHAIN, mirrorAt);
        mirror = new IncomeMirror(address(cTp), L1, address(rlog), fleet);
        assertEq(address(mirror), mirrorAt);

        vm.startPrank(manager);
        car = fleet.listCar("Mazda CX-5 2024", "", bytes32(0), operator, 10, 100e6, 1 days);
        rlog.setOperator(car, operator);
        vm.stopPrank();

        vm.startPrank(investor);
        usdc.faucet();
        usdc.approve(address(fleet), type(uint256).max);
        fleet.buyShares(car, 10);
        vm.stopPrank();
        vm.prank(operator);
        usdc.approve(address(fleet), type(uint256).max);
    }

    function test_reportedIncomeNextToRentPaid() public {
        vm.startPrank(operator);
        rlog.logRental(car, keccak256("rental 1"), 3, 150e6);
        rlog.logRental(car, keccak256("rental 2"), 2, 100e6);
        vm.stopPrank();

        rlog.report(car); // anyone
        l1Tp.deliverLast();

        (uint256 reportedIncome, uint256 rentPaid, uint256 unpaid) = mirror.ledger(car);
        assertEq(reportedIncome, 250e6);
        assertEq(rentPaid, 0);
        assertEq(unpaid, 250e6);

        vm.prank(operator);
        fleet.payRent(car, 250e6);
        (, rentPaid, unpaid) = mirror.ledger(car);
        assertEq(rentPaid, 250e6);
        assertEq(unpaid, 0);

        (uint32 periods, uint32 rentals, uint32 daysRented,) = mirror.reported(car);
        assertEq(periods, 1);
        assertEq(rentals, 2);
        assertEq(daysRented, 5);
    }

    function test_periodsAccumulate_eachSentOnce() public {
        vm.prank(operator);
        rlog.logRental(car, keccak256("a"), 1, 50e6);
        rlog.report(car);
        vm.expectRevert(RentalLog.NothingToReport.selector);
        rlog.report(car);
        vm.prank(operator);
        rlog.logRental(car, keccak256("b"), 1, 70e6);
        rlog.report(car);

        l1Tp.deliver(1); // out of order is fine
        l1Tp.deliver(0);
        (uint256 reportedIncome,,) = mirror.ledger(car);
        assertEq(reportedIncome, 120e6);
    }

    function test_onlyOperatorLogs_eachRentalOnce() public {
        vm.prank(investor);
        vm.expectRevert(RentalLog.NotOperator.selector);
        rlog.logRental(car, keccak256("x"), 1, 1e6);

        vm.startPrank(operator);
        rlog.logRental(car, keccak256("x"), 1, 1e6);
        vm.expectRevert(RentalLog.AlreadyLogged.selector);
        rlog.logRental(car, keccak256("x"), 1, 1e6);
        vm.expectRevert(RentalLog.BadRental.selector);
        rlog.logRental(car, keccak256("y"), 0, 1e6);
        vm.stopPrank();

        vm.prank(operator);
        vm.expectRevert(RentalLog.NotManager.selector);
        rlog.setOperator(car, operator);
    }

    function test_mirrorRejectsWrongSourcesAndDuplicates() public {
        bytes memory body = abi.encode(car, uint32(1), uint32(1), uint32(1), uint256(5e6));

        vm.expectRevert(IncomeMirror.NotTeleporter.selector);
        mirror.receiveTeleporterMessage(L1, address(rlog), body);

        vm.startPrank(address(cTp));
        vm.expectRevert(IncomeMirror.WrongSource.selector);
        mirror.receiveTeleporterMessage(keccak256("other"), address(rlog), body);
        vm.expectRevert(IncomeMirror.WrongSource.selector);
        mirror.receiveTeleporterMessage(L1, makeAddr("impostor"), body);

        mirror.receiveTeleporterMessage(L1, address(rlog), body);
        vm.expectRevert(IncomeMirror.Duplicate.selector);
        mirror.receiveTeleporterMessage(L1, address(rlog), body);
        vm.stopPrank();
    }
}
