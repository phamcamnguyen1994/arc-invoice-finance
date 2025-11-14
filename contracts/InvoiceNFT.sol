// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title InvoiceNFT
 * @notice ERC721 token representing tokenized invoices. Stores immutable invoice metadata
 *         and enforces role-based access control for lifecycle transitions.
 */
contract InvoiceNFT is ERC721, AccessControl {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE");
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    enum InvoiceStatus {
        Draft,
        Listed,
        Funded,
        Settled,
        Defaulted,
        Cancelled
    }

    struct InvoiceData {
        address issuer;
        address debtor;
        uint256 faceValue;
        uint64 dueDate;
        uint64 createdAt;
        InvoiceStatus status;
        string offchainRef;
    }

    uint256 private _idTracker;
    mapping(uint256 => InvoiceData) private _invoices;

    event InvoiceMinted(uint256 indexed invoiceId, address indexed issuer, address indexed debtor);
    event InvoiceStatusUpdated(uint256 indexed invoiceId, InvoiceStatus previousStatus, InvoiceStatus newStatus);
    event InvoiceOffchainRefUpdated(uint256 indexed invoiceId, string offchainRef);
    event InvoiceDebtorUpdated(uint256 indexed invoiceId, address previousDebtor, address newDebtor);

    error InvalidRecipient();
    error InvalidDebtor();
    error InvalidFaceValue();
    error InvalidDueDate();
    error InvoiceDoesNotExist();

    function _invoiceExists(uint256 invoiceId) internal view returns (bool) {
        return _ownerOf(invoiceId) != address(0);
    }

    function latestInvoiceId() external view returns (uint256) {
        return _idTracker;
    }

    constructor(address admin) ERC721("Arc Invoice", "ARCINV") {
        if (admin == address(0)) {
            revert InvalidRecipient();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function invoiceData(uint256 invoiceId) external view returns (InvoiceData memory) {
        if (!_invoiceExists(invoiceId)) {
            revert InvoiceDoesNotExist();
        }
        return _invoices[invoiceId];
    }

    function mintInvoice(
        address recipient,
        address issuer,
        address debtor,
        uint256 faceValue,
        uint64 dueDate,
        string calldata offchainRef
    ) external onlyRole(MINTER_ROLE) returns (uint256 invoiceId) {
        if (recipient == address(0) || issuer == address(0)) {
            revert InvalidRecipient();
        }
        if (debtor == address(0)) {
            revert InvalidDebtor();
        }
        if (faceValue == 0) {
            revert InvalidFaceValue();
        }
        if (dueDate <= block.timestamp) {
            revert InvalidDueDate();
        }

        invoiceId = ++_idTracker;
        _safeMint(recipient, invoiceId);

        _invoices[invoiceId] = InvoiceData({
            issuer: issuer,
            debtor: debtor,
            faceValue: faceValue,
            dueDate: dueDate,
            createdAt: uint64(block.timestamp),
            status: InvoiceStatus.Draft,
            offchainRef: offchainRef
        });

        emit InvoiceMinted(invoiceId, issuer, debtor);
    }

    function updateStatus(uint256 invoiceId, InvoiceStatus newStatus) external onlyRole(MARKETPLACE_ROLE) {
        if (!_invoiceExists(invoiceId)) {
            revert InvoiceDoesNotExist();
        }
        InvoiceStatus previous = _invoices[invoiceId].status;
        _invoices[invoiceId].status = newStatus;
        emit InvoiceStatusUpdated(invoiceId, previous, newStatus);
    }

    function setOffchainRef(uint256 invoiceId, string calldata offchainRef) external onlyRole(MARKETPLACE_ROLE) {
        if (!_invoiceExists(invoiceId)) {
            revert InvoiceDoesNotExist();
        }
        _invoices[invoiceId].offchainRef = offchainRef;
        emit InvoiceOffchainRefUpdated(invoiceId, offchainRef);
    }

    function setDebtor(uint256 invoiceId, address newDebtor) external onlyRole(MARKETPLACE_ROLE) {
        if (!_invoiceExists(invoiceId)) {
            revert InvoiceDoesNotExist();
        }
        if (newDebtor == address(0)) {
            revert InvalidDebtor();
        }
        address previous = _invoices[invoiceId].debtor;
        _invoices[invoiceId].debtor = newDebtor;
        emit InvoiceDebtorUpdated(invoiceId, previous, newDebtor);
    }
}

