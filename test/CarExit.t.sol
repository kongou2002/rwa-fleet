// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {IERC1155Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {FleetShares} from "../src/FleetShares.sol";
import {CarExit} from "../src/CarExit.sol";

contract CarExitTest is Test {
    MockUSDC usdc;
    FleetShares fleet;
    CarExit exit;
    address manager = makeAddr("manager");
    address operator = makeAddr("rental operator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint32 constant SHARES = 100;
    uint256 constant PRICE = 30e6;
    uint256 constant PROCEEDS = 2_000e6; // the car resold for 2,000 USDC
    uint256 car;

    event CarSold(uint256 indexed carId, address indexed operator, uint256 proceeds);
    event Redeemed(uint256 indexed carId, address indexed holder, uint32 shares, uint256 paid);

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        fleet = new FleetShares(usdc, manager);
        exit = new CarExit(fleet);
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
        usdc.approve(address(exit), type(uint256).max);
        fleet.setApprovalForAll(address(exit), true);
        vm.stopPrank();
    }

    function _sellOut() internal {
        vm.prank(alice);
        fleet.buyShares(car, 60);
        vm.prank(bob);
        fleet.buyShares(car, 40);
    }

    function _settle(uint256 proceeds) internal {
        vm.prank(operator);
        exit.settle(car, proceeds);
    }

    function _redeem(address who, uint32 shares) internal returns (uint256 paid) {
        uint256 before = usdc.balanceOf(who);
        vm.prank(who);
        paid = exit.redeem(car, shares);
        assertEq(usdc.balanceOf(who), before + paid, "paid amount reaches the holder");
    }

    // ---------- constructor ----------

    function test_readsTokenFromFleet() public view {
        assertEq(address(exit.fleet()), address(fleet));
        assertEq(address(exit.token()), address(usdc));
    }

    // ---------- settle ----------

    function test_settle_pullsProceedsAndRecords() public {
        _sellOut();
        uint256 opBefore = usdc.balanceOf(operator);
        vm.expectEmit(address(exit));
        emit CarSold(car, operator, PROCEEDS);
        _settle(PROCEEDS);

        assertEq(usdc.balanceOf(address(exit)), PROCEEDS);
        assertEq(usdc.balanceOf(operator), opBefore - PROCEEDS);
        CarExit.Exit memory e = exit.exitOf(car);
        assertEq(e.proceeds, PROCEEDS);
        assertEq(e.paidOut, 0);
        assertEq(e.totalShares, SHARES);
        assertEq(e.redeemedShares, 0);
        assertEq(e.soldAt, block.timestamp);
    }

    function test_settle_noFeeOnResale() public {
        _sellOut();
        _settle(PROCEEDS);
        assertEq(fleet.feesOwed(), 0);
        assertEq(usdc.balanceOf(manager), 0);
    }

    function test_settle_revertsOnZeroProceeds() public {
        _sellOut();
        vm.prank(operator);
        vm.expectRevert(CarExit.ZeroAmount.selector);
        exit.settle(car, 0);
    }

    function test_settle_onlyOperator() public {
        _sellOut();
        vm.prank(alice);
        vm.expectRevert(CarExit.NotOperator.selector);
        exit.settle(car, PROCEEDS);
        vm.prank(manager);
        vm.expectRevert(CarExit.NotOperator.selector);
        exit.settle(car, PROCEEDS);
    }

    function test_settle_unknownCar() public {
        vm.prank(operator);
        vm.expectRevert(CarExit.NotOperator.selector);
        exit.settle(99, PROCEEDS);
    }

    function test_settle_onlyWhileActive() public {
        vm.prank(alice);
        fleet.buyShares(car, 10);
        vm.prank(operator);
        vm.expectRevert(CarExit.WrongStatus.selector);
        exit.settle(car, PROCEEDS); // still Funding

        vm.warp(block.timestamp + 7 days + 1);
        fleet.cancelFunding(car);
        vm.prank(operator);
        vm.expectRevert(CarExit.WrongStatus.selector);
        exit.settle(car, PROCEEDS); // Cancelled
    }

    function test_settle_onlyOnce() public {
        _sellOut();
        _settle(PROCEEDS);
        vm.prank(operator);
        vm.expectRevert(CarExit.AlreadySold.selector);
        exit.settle(car, 1);
    }

    // ---------- redeem ----------

    function test_redeem_beforeSettle() public {
        _sellOut();
        vm.prank(alice);
        vm.expectRevert(CarExit.NotSold.selector);
        exit.redeem(car, 1);
    }

    function test_redeem_zeroShares() public {
        _sellOut();
        _settle(PROCEEDS);
        vm.prank(alice);
        vm.expectRevert(CarExit.ZeroAmount.selector);
        exit.redeem(car, 0);
    }

    function test_redeem_moreThanHeld() public {
        _sellOut();
        _settle(PROCEEDS);
        vm.prank(alice);
        vm.expectRevert(CarExit.NotEnoughShares.selector);
        exit.redeem(car, 61);
        vm.prank(carol);
        vm.expectRevert(CarExit.NotEnoughShares.selector);
        exit.redeem(car, 1);
    }

    function test_redeem_needsApproval() public {
        _sellOut();
        _settle(PROCEEDS);
        vm.prank(alice);
        fleet.setApprovalForAll(address(exit), false);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IERC1155Errors.ERC1155MissingApprovalForAll.selector, address(exit), alice)
        );
        exit.redeem(car, 1);
    }

    function test_redeem_proRata_includingOfferBookBuyer() public {
        _sellOut();
        vm.prank(alice);
        uint256 offer = fleet.makeOffer(car, 20, 35e6);
        vm.prank(carol);
        fleet.takeOffer(offer, 15); // alice 45, bob 40, carol 15
        _settle(PROCEEDS);

        assertEq(exit.redeemable(car, alice), 900e6);
        assertEq(exit.redeemable(car, bob), 800e6);
        assertEq(exit.redeemable(car, carol), 300e6);

        vm.expectEmit(address(exit));
        emit Redeemed(car, carol, 15, 300e6);
        assertEq(_redeem(carol, 15), 300e6);
        assertEq(_redeem(alice, 45), 900e6);
        assertEq(_redeem(bob, 40), 800e6);

        CarExit.Exit memory e = exit.exitOf(car);
        assertEq(e.redeemedShares, SHARES);
        assertEq(e.paidOut, PROCEEDS);
        assertEq(usdc.balanceOf(address(exit)), 0);
        assertEq(fleet.balanceOf(address(exit), car), SHARES, "redeemed shares are locked here");
        assertEq(fleet.balanceOf(alice, car) + fleet.balanceOf(bob, car) + fleet.balanceOf(carol, car), 0);
    }

    function test_redeem_inParts() public {
        _sellOut();
        _settle(PROCEEDS);
        assertEq(_redeem(alice, 10), 200e6);
        assertEq(exit.redeemable(car, alice), 1_000e6);
        assertEq(_redeem(alice, 50), 1_000e6);
        assertEq(exit.redeemable(car, alice), 0);
        vm.prank(alice);
        vm.expectRevert(CarExit.NotEnoughShares.selector);
        exit.redeem(car, 1);
    }

    function test_dust_goesToLastRedeemer() public {
        _sellOut();
        _settle(1_000_001); // 1.000001 USDC does not split evenly over 100 shares
        assertEq(_redeem(alice, 60), 600_000); // floor(1_000_001 * 60 / 100)
        assertEq(usdc.balanceOf(address(exit)), 400_001, "dust waits in the contract");
        assertEq(exit.redeemable(car, bob), 400_001, "the last share takes the remainder");
        assertEq(_redeem(bob, 40), 400_001);
        assertEq(usdc.balanceOf(address(exit)), 0);
        assertEq(exit.exitOf(car).paidOut, 1_000_001);
    }

    function test_dust_threeEqualHolders() public {
        vm.prank(manager);
        uint256 small = fleet.listCar("Kia Morning", "", bytes32(0), operator, 3, 1e6, 1 days);
        vm.prank(alice);
        fleet.buyShares(small, 1);
        vm.prank(bob);
        fleet.buyShares(small, 1);
        vm.prank(carol);
        fleet.buyShares(small, 1);
        vm.prank(operator);
        exit.settle(small, 100);

        vm.prank(alice);
        assertEq(exit.redeem(small, 1), 33);
        vm.prank(bob);
        assertEq(exit.redeem(small, 1), 33);
        vm.prank(carol);
        assertEq(exit.redeem(small, 1), 34);
        assertEq(usdc.balanceOf(address(exit)), 0);
    }

    function test_unclaimedRentSurvivesRedeem() public {
        _sellOut();
        vm.prank(operator);
        fleet.payRent(car, 100e6);
        assertEq(fleet.claimable(car, alice), 54e6);

        _settle(PROCEEDS);
        _redeem(alice, 60);
        assertEq(fleet.balanceOf(alice, car), 0);
        assertEq(fleet.claimable(car, alice), 54e6, "rent earned before redeeming stays with alice");
        assertEq(fleet.claimable(car, address(exit)), 0, "exit contract does not inherit it");

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        fleet.claim(car);
        assertEq(usdc.balanceOf(alice), before + 54e6);
    }

    /// Documents the known limit: rent paid after the sale is split over all shares, and the part on shares already
    /// locked in CarExit is credited to CarExit, which never claims it.
    function test_rentAfterSale_accruesToLockedShares() public {
        _sellOut();
        _settle(PROCEEDS);
        _redeem(alice, 60);
        vm.prank(operator);
        fleet.payRent(car, 100e6);
        assertEq(fleet.claimable(car, address(exit)), 54e6);
        assertEq(fleet.claimable(car, bob), 36e6, "holders who have not redeemed still earn");
    }

    function test_sharesStillTradeAfterSale_buyerCanRedeem() public {
        _sellOut();
        _settle(PROCEEDS);
        vm.prank(bob);
        uint256 offer = fleet.makeOffer(car, 40, 19e6);
        vm.prank(carol);
        fleet.takeOffer(offer, 40);
        assertEq(_redeem(carol, 40), 800e6);
    }

    // ---------- receiver hooks ----------

    function test_rejectsSharesSentDirectly() public {
        _sellOut();
        vm.prank(alice);
        vm.expectRevert(CarExit.UnexpectedTransfer.selector);
        fleet.safeTransferFrom(alice, address(exit), car, 1, "");
    }

    function test_rejectsBatchTransfers() public {
        _sellOut();
        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = car;
        amounts[0] = 1;
        vm.prank(alice);
        vm.expectRevert(CarExit.UnexpectedTransfer.selector);
        fleet.safeBatchTransferFrom(alice, address(exit), ids, amounts, "");
    }

    function test_rejectsOtherTokenContracts() public {
        vm.prank(alice);
        vm.expectRevert(CarExit.UnexpectedTransfer.selector);
        exit.onERC1155Received(address(exit), alice, 1, 1, "");
    }

    function test_supportsInterface() public view {
        assertTrue(exit.supportsInterface(type(IERC1155Receiver).interfaceId));
        assertTrue(exit.supportsInterface(type(IERC165).interfaceId));
        assertFalse(exit.supportsInterface(0xffffffff));
    }

    // ---------- views ----------

    function test_redeemable_zeroBeforeSettleAndForNonHolders() public {
        _sellOut();
        assertEq(exit.redeemable(car, alice), 0);
        _settle(PROCEEDS);
        assertEq(exit.redeemable(car, carol), 0);
        assertEq(exit.redeemable(car, alice), 1_200e6);
    }

    // ---------- fuzz ----------

    function testFuzz_totalPaidNeverExceedsProceeds(uint256 a, uint256 b, uint256 aFirst, uint256 proceeds)
        public
    {
        a = bound(a, 1, SHARES - 2);
        b = bound(b, 1, SHARES - 1 - a);
        uint256 c = SHARES - a - b;
        aFirst = bound(aFirst, 1, a);
        proceeds = bound(proceeds, 1, 1e30);

        vm.prank(alice);
        fleet.buyShares(car, uint32(a));
        vm.prank(bob);
        fleet.buyShares(car, uint32(b));
        vm.prank(carol);
        fleet.buyShares(car, uint32(c));

        deal(address(usdc), operator, proceeds);
        _settle(proceeds);

        uint256 paid;
        paid += _redeem(alice, uint32(aFirst));
        assertLe(paid, proceeds);
        paid += _redeem(carol, uint32(c));
        assertLe(paid, proceeds);
        if (a > aFirst) {
            paid += _redeem(alice, uint32(a - aFirst));
            assertLe(paid, proceeds);
        }
        paid += _redeem(bob, uint32(b));
        assertEq(paid, proceeds, "everything is paid out once every share is redeemed");
        assertEq(usdc.balanceOf(address(exit)), 0);
        assertEq(exit.exitOf(car).paidOut, paid);
    }
}
