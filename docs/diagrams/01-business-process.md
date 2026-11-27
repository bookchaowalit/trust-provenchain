# 01 — Business process (As-Is / To-Be)

ProvenChain คือ MVP core สำหรับพิสูจน์ความถูกต้องของเอกสาร: CLI hash เอกสารแบบ SHA-256 บนเครื่อง และ smart contract `NotaryRegistry` เก็บเฉพาะ hash, ผู้ส่ง และเวลา block บน EVM chain โดยไม่เก็บเนื้อหาเอกสาร วันนี้ทำงานแบบ local / ทดสอบ offline เท่านั้น ยังไม่ deploy ขึ้น testnet

Last reviewed: 2026-11-28 · commit `ac6df90`

## As-Is (จากโค้ดวันนี้)

```mermaid
flowchart TD
  DOC["local document (founder-owned fixture)"] --> HASH["npm run hash: scripts/hash-document.mjs"]
  HASH --> DIG["JSON: SHA-256 digest 0x..., byte_length, contents_persisted false"]
  DOC --> VER["npm run verify: scripts/verify-document.mjs"]
  DIG -->|"expected digest"| VER
  VER --> MATCH{"digest matches?"}
  MATCH -->|yes| OK["verified"]
  MATCH -->|no| BAD["mismatch"]
  SOL["contracts/NotaryRegistry.sol"] --> COMP["npm run compile: solc 0.8.30 (scripts/compile-contract.mjs)"]
  COMP --> EVM["tests: in-memory EVM (@ethereumjs/evm)"]
  EVM --> NOT["notarize(bytes32): reject zero / duplicate, store submitter + timestamp, emit event"]
  NOT --> GET["getRecord(bytes32): submitter, timestamp, notarized"]
  CI["ci.yml: shared ci-node + security"] --> EVM
  GATE["legal / privacy gate: blocked pending review"] -.->|"no testnet deploy"| NET["EVM testnet (not deployed)"]
```

Sources: `scripts/hash-document.mjs`, `scripts/verify-document.mjs`, `scripts/compile-contract.mjs`, `src/document-hash.mjs`, `contracts/NotaryRegistry.sol`, `tests/notary-registry-evm.test.mjs`, `.github/workflows/ci.yml`, `README.md`, `docs/LEGAL-PRIVACY-GATE.md`

ข้อเท็จจริงจากโค้ด: ไม่มี script deploy, wallet, RPC, API, database หรือ frontend ใน repo; `verify` เทียบ digest บนเครื่องเท่านั้น ไม่ได้อ่าน `getRecord` จาก chain

## To-Be (`PRODUCT.md` §Exit evidence for the next gate; `docs/ARCHITECTURE-DECISION.md`; `docs/LEGAL-PRIVACY-GATE.md`; `docs/DISCOVERY-PLAN.md`)

```mermaid
flowchart TD
  DOC["local document (non-sensitive fixture)"] --> HASH["npm run hash"]
  HASH --> DIG["SHA-256 digest"]
  GATE["legal / privacy gate passed: written opinion, PIA, public-data policy, terms"] --> APPR["human-approved testnet network, wallet, RPC, gas ceiling"]
  APPR --> NET["NotaryRegistry deployed on EVM testnet"]
  DIG -->|"reviewed testnet transaction"| NOT["notarize(bytes32)"]
  NOT --> NET
  NET --> GET["getRecord(bytes32): independent verification"]
  DISC["20 discovery interviews (10 SME + 10 freelancer / agency)"] --> PILOT["3-5 manual pilot users verify sample hashes"]
  GET --> PILOT
  PILOT --> DEC["recommendation: proceed / narrow / pivot / stop"]
```

Sources: `PRODUCT.md` §Exit evidence for the next gate, `docs/ARCHITECTURE-DECISION.md` §Decision, `docs/LEGAL-PRIVACY-GATE.md` §Pre-testnet acceptance gate, `docs/DISCOVERY-PLAN.md`, `docs/INTERVIEW-EVIDENCE-REGISTER.md`

## Gap

| ID | As-Is → To-Be | Status | Owner | Evidence |
|---|---|---|---|---|
| G1 | ไม่มีความเห็นจากผู้เชี่ยวชาญด้านกฎหมาย / privacy → written preliminary opinion, PIA/DPIA, นโยบายข้อมูลสาธารณะ, terms | blocked | owner | `docs/LEGAL-PRIVACY-GATE.md` §Pre-testnet acceptance gate (Decision: blocked pending review) |
| G2 | ยังไม่เลือก network, wallet, RPC และงบ gas → owner อนุมัติ testnet network และ gas ceiling | blocked | owner | `docs/ARCHITECTURE-DECISION.md` §Explicit non-decisions; gate row Network budget |
| G3 | ไม่มี deploy และ testnet transaction → contract บน testnet + reviewed transaction (deploy ไม่อัตโนมัติจนกว่า gate ผ่าน) | blocked | claude | `README.md` §Testnet boundary; `PRODUCT.md` §Exit evidence |
| G4 | `verify` เทียบ digest บนเครื่องเท่านั้น → ตรวจกับ `getRecord` บน chain เพื่อ independent verification [ต้องยืนยัน] ว่า owner ต้องการใน CLI นี้ | decide | owner | `scripts/verify-document.mjs`; `PRODUCT.md` §Demo promise |
| G5 | discovery interview 0 จาก 20 → 10 SME + 10 freelancer / agency พร้อมผลสรุปแบบ aggregate | todo | owner | `docs/INTERVIEW-EVIDENCE-REGISTER.md` (Interviews completed 0); `docs/DISCOVERY-PLAN.md` |
| G6 | ไม่มี pilot user → 3–5 manual pilot users ตรวจ sample hash | todo | owner | `PRODUCT.md` §Exit evidence |
| G7 | การตัดสินใจ proceed / narrow / pivot / stop ยังรอหลักฐาน → owner บันทึก recommendation | decide | owner | `docs/DISCOVERY-PLAN.md` (Decision: pending evidence) |

## Open questions

- gate control "Secret boundary" (wallet / RPC ผ่านกลไก secret ที่อนุมัติ) จะใช้ Infisical หรือไม่ ยังไม่มีเอกสารระบุ
