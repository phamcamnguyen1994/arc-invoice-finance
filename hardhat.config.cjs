process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || 'tsconfig.hardhat.json';
require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

const {
  ARC_TESTNET_RPC_URL,
  ARC_RPC_URL,
  PRIVATE_KEY,
  FUNDER_PRIVATE_KEY,
  ARC_SCAN_API_KEY,
} = process.env;

/** @type {import('hardhat/config').HardhatUserConfig} */
const networks = {
  hardhat: {},
};

const rpcUrl = ARC_TESTNET_RPC_URL || ARC_RPC_URL;
const deployerKey = PRIVATE_KEY || FUNDER_PRIVATE_KEY;

if (rpcUrl) {
  networks.arcTestnet = {
    url: rpcUrl,
    chainId: 5042002,
    accounts: deployerKey ? [deployerKey] : [],
  };
}

const config = {
  solidity: {
    version: '0.8.22',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks,
  etherscan: {
    apiKey: {
      arcTestnet: ARC_SCAN_API_KEY || undefined,
    },
  },
  mocha: {
    spec: ['test/**/*.cjs'],
    timeout: 60_000,
  },
};

module.exports = config;

