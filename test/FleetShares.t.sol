// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {FleetShares} from "../src/FleetShares.sol";

contract FleetSharesTest is Test {
    MockUSDC usdc;
    FleetShares fleet;
    address manager = makeAddr("manager");
    address operator = makeAddr("rental operator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint32 constant SHARES = 100;
    uint256 constant PRICE = 30e6; // 100 shares x 30 USDC = a 3,000 USDC test car
    uint256 car;

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        fleet = new FleetShares(usdc, manager);
        _fund(alice, 4);
        _fund(bob, 4);
        _fund(carol, 4);
        _fund(operator, 2);
        vm.prank(manager);
        car = fleet.listCar("Mazda CX-5 2024", "ipfs://cx5", keccak256("docs"), operator, SHARES, PRICE, 7 days);
    }

    function _fund(address who, uint256 drips) internal {
        vm.startPrank(who);
        for (uint256 i = 0; i < drips; i++) {
            usdc.faucet();
            vm.warp(block.timestamp + usdc.FAUCET_COOLDOWN());
        }
        usdc.approve(address(fleet), type(uint256).max);
        vm.stopPrank();
    }

    function _sellOut() internal {
        vm.prank(alice);
        fleet.buyShares(car, 60);
        vm.prank(bob);
        fleet.buyShares(car, 40);
    }

    // ---------- listing and funding ----------

    function test_onlyManagerLists() public {
        vm.prank(alice);
        vm.expectRevert(FleetShares.NotManager.selector);
        fleet.listCar("x", "", bytes32(0), operator, 1, 1, 1);
    }

    function test_moneyStaysInContractUntilSoldOut() public {
        vm.prank(alice);
        fleet.buyShares(car, 60);
        assertEq(usdc.balanceOf(address(fleet)), 60 * PRICE);
        assertEq(usdc.balanceOf(operator), 2_000e6, "operator not paid yet");
        assertEq(uint8(fleet.getCar(car).status), uint8(FleetShares.Status.Funding));
    }

    function test_soldOutPaysOperator_neverManager() public {
        _sellOut();
        assertEq(uint8(fleet.getCar(car).status), uint8(FleetShares.Status.Active));
        assertEq(usdc.balanceOf(operator), 2_000e6 + SHARES * PRICE);
        assertEq(usdc.balanceOf(manager), 0);
        assertEq(usdc.balanceOf(address(fleet)), 0);
    }

    function test_cannotOversell() public {
        vm.prank(alice);
        fleet.buyShares(car, 60);
        vm.prank(bob);
        vm.expectRevert(FleetShares.NotEnoughShares.selector);
        fleet.buyShares(car, 41);
    }

    function test_missedDeadlineRefundsEveryBuyer() public {
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        fleet.buyShares(car, 60);

        vm.expectRevert(FleetShares.FundingOpen.selector);
        fleet.cancelFunding(car);

        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(bob);
        vm.expectRevert(FleetShares.FundingClosed.selector);
        fleet.buyShares(car, 40);

        fleet.cancelFunding(car);
        vm.prank(alice);
        fleet.refund(car);
        assertEq(usdc.balanceOf(alice), before);
        assertEq(fleet.balanceOf(alice, car), 0);
        vm.prank(alice);
        vm.expectRevert(FleetShares.NothingToClaim.selector);
        fleet.refund(car);
    }

    function test_sharesLockedWhileFunding() public {
        vm.prank(alice);
        fleet.buyShares(car, 10);
        vm.prank(alice);
        vm.expectRevert(FleetShares.TransfersLocked.selector);
        fleet.safeTransferFrom(alice, bob, car, 5, "");
    }

    // ---------- rent ----------

    function test_rentSplit_10PercentFee_restProRata() public {
        _sellOut();
        vm.prank(operator);
        fleet.payRent(car, 100e6);

        assertEq(fleet.feesOwed(), 10e6);
        assertEq(fleet.claimable(car, alice), 54e6); // 60 % of 90
        assertEq(fleet.claimable(car, bob), 36e6); // 40 % of 90

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        fleet.claim(car);
        assertEq(usdc.balanceOf(alice), before + 54e6);
        vm.prank(alice);
        vm.expectRevert(FleetShares.NothingToClaim.selector);
        fleet.claim(car);

        fleet.withdrawFees();
        assertEq(usdc.balanceOf(manager), 10e6);
    }

    function test_onlyOperatorPaysRent_onlyWhenActive() public {
        vm.prank(operator);
        vm.expectRevert(FleetShares.WrongStatus.selector);
        fleet.payRent(car, 1e6);
        _sellOut();
        vm.prank(alice);
        vm.expectRevert(FleetShares.NotOperator.selector);
        fleet.payRent(car, 1e6);
    }

    function test_rentEarnedBeforeASaleStaysWithTheSeller() public {
        _sellOut();
        vm.prank(operator);
        fleet.payRent(car, 100e6);

        vm.prank(alice);
        fleet.safeTransferFrom(alice, carol, car, 60, "");
        assertEq(fleet.claimable(car, alice), 54e6, "seller keeps rent already earned");
        assertEq(fleet.claimable(car, carol), 0);

        vm.prank(operator);
        fleet.payRent(car, 100e6);
        assertEq(fleet.claimable(car, alice), 54e6);
        assertEq(fleet.claimable(car, carol), 54e6);
        assertEq(fleet.claimable(car, bob), 72e6);
    }

    function test_contractHoldsExactlyWhatItOwes() public {
        _sellOut();
        vm.startPrank(operator);
        fleet.payRent(car, 33_333_333);
        fleet.payRent(car, 7);
        vm.stopPrank();
        uint256 owed = fleet.claimable(car, alice) + fleet.claimable(car, bob) + fleet.feesOwed();
        assertLe(owed, usdc.balanceOf(address(fleet)));
        assertLt(usdc.balanceOf(address(fleet)) - owed, SHARES, "only rounding dust is left over");
    }

    // ---------- secondary market ----------

    function test_offerAndTake() public {
        _sellOut();
        vm.prank(alice);
        uint256 id = fleet.makeOffer(car, 20, 35e6);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(carol);
        fleet.takeOffer(id, 15);
        assertEq(fleet.balanceOf(carol, car), 15);
        assertEq(fleet.balanceOf(alice, car), 45);
        assertEq(usdc.balanceOf(alice), aliceBefore + 15 * 35e6);
        assertEq(fleet.getOffer(id).amount, 5);

        vm.prank(carol);
        vm.expectRevert(FleetShares.NotEnoughShares.selector);
        fleet.takeOffer(id, 6);
    }

    function test_offerNeedsFundedCarAndShares() public {
        vm.prank(alice);
        fleet.buyShares(car, 10);
        vm.prank(alice);
        vm.expectRevert(FleetShares.WrongStatus.selector);
        fleet.makeOffer(car, 5, 1e6);

        vm.prank(bob);
        fleet.buyShares(car, 90);
        vm.prank(alice);
        vm.expectRevert(FleetShares.NotEnoughShares.selector);
        fleet.makeOffer(car, 11, 1e6);
    }

    function test_cancelOffer_andSellerWhoMovedShares() public {
        _sellOut();
        vm.prank(alice);
        uint256 id = fleet.makeOffer(car, 60, 35e6);
        vm.prank(bob);
        vm.expectRevert(FleetShares.NotSeller.selector);
        fleet.cancelOffer(id);

        // Seller moves the shares elsewhere: the stale offer cannot be taken.
        vm.prank(alice);
        fleet.safeTransferFrom(alice, bob, car, 60, "");
        vm.prank(carol);
        vm.expectRevert(FleetShares.NotEnoughShares.selector);
        fleet.takeOffer(id, 1);

        vm.prank(alice);
        fleet.cancelOffer(id);
        assertEq(fleet.getOffer(id).amount, 0);
    }
}
