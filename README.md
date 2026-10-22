# ProvenChain

Notarization-only MVP core for document integrity. It hashes a document locally
and provides a small Solidity registry that can timestamp the hash on an EVM
chain. The document contents never enter the contract.

## Scope

This is an intentionally narrow, local/testnet-ready vertical slice:

1. SHA-256 a local document with the CLI.
2. Compile `NotaryRegistry.sol` locally.
3. Use the contract's `notarize(bytes32)` and `getRecord(bytes32)` methods on a
   testnet only after human approval and legal review.

There is no escrow, token, custody, payment, customer upload service, or
mainnet deployment in this repository.

## Quick start

```bash
npm install
npm test            # hashing, compile, and EVM behaviour tests (offline)
npm run typecheck # tsc --noEmit, strict checkJs
npm run compile
npm run hash -- ./path/to/document.pdf
npm run verify -- ./path/to/document.pdf 0x<sha256-digest>
```

The hash and verify commands emit metadata and a `0x`-prefixed SHA-256 digest.
They do not copy the document or persist its contents.

## Contract

[`contracts/NotaryRegistry.sol`](contracts/NotaryRegistry.sol) stores only:

- the document hash;
- the submitting address;
- the block timestamp.

Each hash can be registered once. Anyone can read the record. There is no admin
key, payable function, upgrade path, or document-content storage.

## Testnet boundary

Deployment is deliberately not automated yet. Before any testnet transaction,
complete the legal/privacy gate and obtain approval for the specific network,
wallet, RPC, and gas budget. Never put a private key in this repository or in a
command line argument.

See:

- [`PRODUCT.md`](PRODUCT.md)
- [`docs/ARCHITECTURE-DECISION.md`](docs/ARCHITECTURE-DECISION.md)
- [`docs/SECURITY-AND-PRIVACY.md`](docs/SECURITY-AND-PRIVACY.md)
- [`docs/TEST-STRATEGY.md`](docs/TEST-STRATEGY.md)
- [`docs/DISCOVERY-PLAN.md`](docs/DISCOVERY-PLAN.md)
- [`docs/INTERVIEW-GUIDE.md`](docs/INTERVIEW-GUIDE.md)
- [`docs/LEGAL-PRIVACY-GATE.md`](docs/LEGAL-PRIVACY-GATE.md)
- [`docs/LEGAL-PRIVACY-EVIDENCE-2026-08-24.md`](docs/LEGAL-PRIVACY-EVIDENCE-2026-08-24.md)
- [`docs/LEGAL-REVIEW-REQUEST.md`](docs/LEGAL-REVIEW-REQUEST.md)
- [`docs/PIA-WORKSHEET.md`](docs/PIA-WORKSHEET.md)
- [`docs/INTERVIEW-EVIDENCE-REGISTER.md`](docs/INTERVIEW-EVIDENCE-REGISTER.md)
