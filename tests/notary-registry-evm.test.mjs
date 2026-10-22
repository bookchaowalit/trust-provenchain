// Behaviour tests for NotaryRegistry.sol: the compiled bytecode is deployed into an
// in-process EVM (@ethereumjs/evm, no network, no RPC, no private key) and called the
// way a wallet would. Covers the "Required before testnet" Solidity cases in
// docs/TEST-STRATEGY.md: zero hash, first registration, duplicate registration,
// event fields and read-back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEVM } from '@ethereumjs/evm';
import { Account, bytesToHex, createAddressFromString, hexToBytes } from '@ethereumjs/util';
import { keccak_256 as keccak256 } from '@noble/hashes/sha3.js';
import { compileContract } from '../scripts/compile-contract.mjs';
import { hashDocument } from '../src/document-hash.mjs';

/** @typedef {import('@ethereumjs/util').Address} Address */
/** @typedef {import('@ethereumjs/evm').EVM} EVM */
/** @typedef {import('@ethereumjs/evm').EVMResult} EVMResult */
/** @typedef {`0x${string}`} Hex */

const DEPLOYER = createAddressFromString('0x1000000000000000000000000000000000000001');
const ALICE = createAddressFromString('0x2000000000000000000000000000000000000002');
const BOB = createAddressFromString('0x3000000000000000000000000000000000000003');
const BLOCK_TIME = 1_767_225_600n; // 2026-01-01T00:00:00Z
const GAS_LIMIT = 5_000_000n;

/** @param {string} signature */
function selector(signature) {
  return keccak256(new TextEncoder().encode(signature)).slice(0, 4);
}

/** @param {string} signature */
function topic(signature) {
  return bytesToHex(keccak256(new TextEncoder().encode(signature)));
}

/** @param {...Uint8Array} parts */
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** @param {Uint8Array} bytes @param {number} index */
function word(bytes, index) {
  return bytes.slice(index * 32, (index + 1) * 32);
}

/** @param {Uint8Array} bytes */
function toBigInt(bytes) {
  return BigInt(bytesToHex(bytes));
}

/** @param {bigint} timestamp */
function blockAt(timestamp) {
  return {
    header: {
      number: 1n,
      coinbase: createAddressFromString(`0x${'00'.repeat(20)}`),
      timestamp,
      difficulty: 0n,
      prevRandao: new Uint8Array(32),
      gasLimit: 30_000_000n,
      baseFeePerGas: 0n,
      getBlobGasPrice: () => undefined,
    },
  };
}

async function deployRegistry() {
  const { bytecode } = await compileContract({ writeArtifact: false });
  const evm = await createEVM();
  for (const address of [DEPLOYER, ALICE, BOB]) {
    await evm.stateManager.putAccount(address, new Account());
  }
  const result = await evm.runCall({
    caller: DEPLOYER,
    data: hexToBytes(/** @type {Hex} */ (bytecode)),
    gasLimit: GAS_LIMIT,
    block: blockAt(BLOCK_TIME),
  });
  assert.equal(result.execResult.exceptionError, undefined, 'deployment must not revert');
  const address = result.createdAddress;
  assert.ok(address, 'deployment must return a contract address');
  return { evm, address };
}

/**
 * @param {EVM} evm @param {Address} to @param {Address} caller
 * @param {Uint8Array} data @param {bigint} [timestamp]
 */
function call(evm, to, caller, data, timestamp = BLOCK_TIME) {
  return evm.runCall({ to, caller, data, gasLimit: GAS_LIMIT, block: blockAt(timestamp) });
}

/** @param {EVM} evm @param {Address} to @param {Address} caller @param {Hex} documentHash @param {bigint} [timestamp] */
function notarize(evm, to, caller, documentHash, timestamp) {
  return call(evm, to, caller, concat(selector('notarize(bytes32)'), hexToBytes(documentHash)), timestamp);
}

/** @param {EVM} evm @param {Address} to @param {Hex} documentHash */
async function getRecord(evm, to, documentHash) {
  const result = await call(evm, to, BOB, concat(selector('getRecord(bytes32)'), hexToBytes(documentHash)));
  assert.equal(result.execResult.exceptionError, undefined, 'getRecord must not revert');
  const out = result.execResult.returnValue;
  return {
    submitter: bytesToHex(word(out, 0).slice(12)),
    timestamp: toBigInt(word(out, 1)),
    notarized: toBigInt(word(out, 2)) === 1n,
  };
}

/** @param {EVMResult} result */
function revertData(result) {
  assert.ok(result.execResult.exceptionError, 'call was expected to revert');
  return result.execResult.returnValue;
}

const DOCUMENT_HASH = /** @type {Hex} */ (hashDocument(Buffer.from('invoice-example-v1', 'utf8')));

test('an unknown hash reads back as not notarized', async () => {
  const { evm, address } = await deployRegistry();
  assert.deepEqual(await getRecord(evm, address, DOCUMENT_HASH), {
    submitter: `0x${'00'.repeat(20)}`,
    timestamp: 0n,
    notarized: false,
  });
});

test('first registration stores submitter and block timestamp and emits DocumentNotarized', async () => {
  const { evm, address } = await deployRegistry();
  const result = await notarize(evm, address, ALICE, DOCUMENT_HASH);
  assert.equal(result.execResult.exceptionError, undefined);

  assert.deepEqual(await getRecord(evm, address, DOCUMENT_HASH), {
    submitter: ALICE.toString(),
    timestamp: BLOCK_TIME,
    notarized: true,
  });

  const logs = result.execResult.logs ?? [];
  assert.equal(logs.length, 1);
  const [emitter, topics, data] = logs[0];
  assert.equal(bytesToHex(emitter), address.toString());
  assert.deepEqual(topics.map((t) => bytesToHex(t)), [
    topic('DocumentNotarized(bytes32,address,uint64)'),
    DOCUMENT_HASH,
    `0x${'00'.repeat(12)}${ALICE.toString().slice(2)}`,
  ]);
  assert.equal(toBigInt(data), BLOCK_TIME);
});

test('a duplicate registration reverts with AlreadyNotarized and keeps the first record', async () => {
  const { evm, address } = await deployRegistry();
  await notarize(evm, address, ALICE, DOCUMENT_HASH);

  const duplicate = await notarize(evm, address, BOB, DOCUMENT_HASH, BLOCK_TIME + 60n);
  assert.deepEqual(
    bytesToHex(revertData(duplicate)),
    bytesToHex(concat(selector('AlreadyNotarized(bytes32)'), hexToBytes(DOCUMENT_HASH))),
  );
  assert.equal((duplicate.execResult.logs ?? []).length, 0);

  const record = await getRecord(evm, address, DOCUMENT_HASH);
  assert.equal(record.submitter, ALICE.toString());
  assert.equal(record.timestamp, BLOCK_TIME);
});

test('the zero hash is rejected with EmptyDocumentHash', async () => {
  const { evm, address } = await deployRegistry();
  const zero = /** @type {Hex} */ (`0x${'00'.repeat(32)}`);
  const result = await notarize(evm, address, ALICE, zero);
  assert.equal(bytesToHex(revertData(result)), bytesToHex(selector('EmptyDocumentHash()')));
  assert.equal((await getRecord(evm, address, zero)).notarized, false);
});

test('different hashes are recorded independently', async () => {
  const { evm, address } = await deployRegistry();
  const other = /** @type {Hex} */ (hashDocument(Buffer.from('invoice-example-v2', 'utf8')));
  await notarize(evm, address, ALICE, DOCUMENT_HASH);
  const second = await notarize(evm, address, BOB, other, BLOCK_TIME + 1n);
  assert.equal(second.execResult.exceptionError, undefined);

  assert.equal((await getRecord(evm, address, DOCUMENT_HASH)).submitter, ALICE.toString());
  const otherRecord = await getRecord(evm, address, other);
  assert.equal(otherRecord.submitter, BOB.toString());
  assert.equal(otherRecord.timestamp, BLOCK_TIME + 1n);
});

test('the registry rejects ether sent with a call (no payable surface)', async () => {
  const { evm, address } = await deployRegistry();
  await evm.stateManager.putAccount(ALICE, new Account(0n, 10n ** 18n));
  const result = await evm.runCall({
    to: address,
    caller: ALICE,
    value: 1n,
    data: concat(selector('notarize(bytes32)'), hexToBytes(DOCUMENT_HASH)),
    gasLimit: GAS_LIMIT,
    block: blockAt(BLOCK_TIME),
  });
  assert.ok(result.execResult.exceptionError, 'a payable call must revert');
  assert.equal((await getRecord(evm, address, DOCUMENT_HASH)).notarized, false);
});
