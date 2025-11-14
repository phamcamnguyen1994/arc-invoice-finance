// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {InvoiceNFT} from "./InvoiceNFT.sol";

/**
 * @title InvoiceMarketplace
 * @notice Facilitates listing, sale, and settlement of tokenized invoices using USDC on Arc.
 */
contract InvoiceMarketplace is AccessControl, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");
    uint256 private constant MAX_BPS = 10_000;

    struct Listing {
        address seller;
        uint256 minPrice;
        bool active;
    }

    IERC20 public immutable usdc;
    InvoiceNFT public immutable invoiceNFT;
    address public feeRecipient;
    uint96 public protocolFeeBps;

    mapping(uint256 => Listing) public listings;

    event InvoiceCreated(uint256 indexed invoiceId, address indexed issuer, address indexed debtor, uint256 faceValue);
    event InvoiceListed(uint256 indexed invoiceId, address indexed seller, uint256 minPrice);
    event ListingCancelled(uint256 indexed invoiceId, address indexed seller);
    event InvoicePurchased(uint256 indexed invoiceId, address indexed buyer, uint256 price, uint256 protocolFee);
    event InvoiceSettled(uint256 indexed invoiceId, address indexed actor, uint256 amount, uint256 protocolFee);
    event InvoiceDefaulted(uint256 indexed invoiceId, address indexed actor);
    event ProtocolFeeUpdated(uint96 previousFeeBps, uint96 newFeeBps);
    event FeeRecipientUpdated(address indexed previousRecipient, address indexed newRecipient);

    error InvalidAddress();
    error InvalidFee();
    error InvalidPrice();
    error ListingNotActive();
    error NotInvoiceOwner();
    error StatusNotAllowed(InvoiceNFT.InvoiceStatus currentStatus);
    error OnlyDebtor(address expectedDebtor);
    error TransferFailed();

    constructor(
        address admin,
        address usdcToken,
        address feeRecipient_,
        address invoiceNftAddress,
        uint96 protocolFeeBps_
    ) {
        if (admin == address(0) || usdcToken == address(0) || feeRecipient_ == address(0) || invoiceNftAddress == address(0)) {
            revert InvalidAddress();
        }
        if (protocolFeeBps_ > 500) {
            revert InvalidFee();
        }

        usdc = IERC20(usdcToken);
        invoiceNFT = InvoiceNFT(invoiceNftAddress);
        feeRecipient = feeRecipient_;
        protocolFeeBps = protocolFeeBps_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SETTLER_ROLE, admin);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function setProtocolFeeBps(uint96 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > 500) {
            revert InvalidFee();
        }
        uint96 previous = protocolFeeBps;
        protocolFeeBps = newFeeBps;
        emit ProtocolFeeUpdated(previous, newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRecipient == address(0)) {
            revert InvalidAddress();
        }
        address previous = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(previous, newRecipient);
    }

    function createInvoice(
        address debtor,
        uint256 faceValue,
        uint64 dueDate,
        string calldata offchainRef
    ) external nonReentrant returns (uint256 invoiceId) {
        invoiceId = invoiceNFT.mintInvoice(msg.sender, msg.sender, debtor, faceValue, dueDate, offchainRef);
        emit InvoiceCreated(invoiceId, msg.sender, debtor, faceValue);
    }

    function listInvoice(uint256 invoiceId, uint256 minPrice) external nonReentrant {
        InvoiceNFT.InvoiceData memory data = invoiceNFT.invoiceData(invoiceId);
        if (invoiceNFT.ownerOf(invoiceId) != msg.sender) {
            revert NotInvoiceOwner();
        }
        if (data.status != InvoiceNFT.InvoiceStatus.Draft && data.status != InvoiceNFT.InvoiceStatus.Cancelled) {
            revert StatusNotAllowed(data.status);
        }
        if (minPrice == 0 || minPrice > data.faceValue) {
            revert InvalidPrice();
        }

        invoiceNFT.safeTransferFrom(msg.sender, address(this), invoiceId);
        invoiceNFT.updateStatus(invoiceId, InvoiceNFT.InvoiceStatus.Listed);

        listings[invoiceId] = Listing({seller: msg.sender, minPrice: minPrice, active: true});
        emit InvoiceListed(invoiceId, msg.sender, minPrice);
    }

    function cancelListing(uint256 invoiceId) external nonReentrant {
        Listing storage listing = listings[invoiceId];
        if (!listing.active) {
            revert ListingNotActive();
        }
        if (listing.seller != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotInvoiceOwner();
        }

        listing.active = false;
        address seller = listing.seller;
        delete listings[invoiceId];

        invoiceNFT.updateStatus(invoiceId, InvoiceNFT.InvoiceStatus.Draft);
        invoiceNFT.safeTransferFrom(address(this), seller, invoiceId);

        emit ListingCancelled(invoiceId, seller);
    }

    function buyInvoice(uint256 invoiceId) external nonReentrant {
        Listing storage listing = listings[invoiceId];
        if (!listing.active) {
            revert ListingNotActive();
        }

        InvoiceNFT.InvoiceData memory data = invoiceNFT.invoiceData(invoiceId);
        if (data.status != InvoiceNFT.InvoiceStatus.Listed) {
            revert StatusNotAllowed(data.status);
        }

        listing.active = false;
        address seller = listing.seller;
        uint256 price = listing.minPrice;
        delete listings[invoiceId];

        uint256 protocolFee = (price * protocolFeeBps) / MAX_BPS;
        uint256 sellerProceeds = price - protocolFee;

        usdc.safeTransferFrom(msg.sender, feeRecipient, protocolFee);
        usdc.safeTransferFrom(msg.sender, seller, sellerProceeds);

        invoiceNFT.updateStatus(invoiceId, InvoiceNFT.InvoiceStatus.Funded);
        invoiceNFT.safeTransferFrom(address(this), msg.sender, invoiceId);

        emit InvoicePurchased(invoiceId, msg.sender, price, protocolFee);
    }

    function settleInvoice(uint256 invoiceId) external nonReentrant {
        InvoiceNFT.InvoiceData memory data = invoiceNFT.invoiceData(invoiceId);
        if (data.status != InvoiceNFT.InvoiceStatus.Funded) {
            revert StatusNotAllowed(data.status);
        }
        if (msg.sender != data.debtor) {
            revert OnlyDebtor(data.debtor);
        }

        address owner = invoiceNFT.ownerOf(invoiceId);
        uint256 amount = data.faceValue;
        uint256 protocolFee = (amount * protocolFeeBps) / MAX_BPS;
        uint256 investorPayout = amount - protocolFee;

        usdc.safeTransferFrom(msg.sender, feeRecipient, protocolFee);
        usdc.safeTransferFrom(msg.sender, owner, investorPayout);

        invoiceNFT.updateStatus(invoiceId, InvoiceNFT.InvoiceStatus.Settled);

        emit InvoiceSettled(invoiceId, msg.sender, amount, protocolFee);
    }

    function markSettled(uint256 invoiceId) external onlyRole(SETTLER_ROLE) {
        InvoiceNFT.InvoiceData memory data = invoiceNFT.invoiceData(invoiceId);
        if (data.status != InvoiceNFT.InvoiceStatus.Funded) {
            revert StatusNotAllowed(data.status);
        }

        invoiceNFT.updateStatus(invoiceId, InvoiceNFT.InvoiceStatus.Settled);
        emit InvoiceSettled(invoiceId, msg.sender, data.faceValue, 0);
    }

    function markDefaulted(uint256 invoiceId) external onlyRole(SETTLER_ROLE) {
        InvoiceNFT.InvoiceData memory data = invoiceNFT.invoiceData(invoiceId);
        if (data.status != InvoiceNFT.InvoiceStatus.Funded) {
            revert StatusNotAllowed(data.status);
        }

        invoiceNFT.updateStatus(invoiceId, InvoiceNFT.InvoiceStatus.Defaulted);
        emit InvoiceDefaulted(invoiceId, msg.sender);
    }
}

