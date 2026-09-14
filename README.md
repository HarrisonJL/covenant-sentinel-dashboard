# Covenant Sentinel Dashboard

A lender/borrower dashboard for Covenant Sentinel, a [GenLayer](https://genlayer.com) Intelligent Contract for debt-covenant monitoring on tokenized RWA / private-credit facilities. This repo is the Project layer built on top of that contract - the contract source is included directly here (see Contract below) so the integration and adjudication behavior can be verified in this repo alone; the contract's own development history, design rationale, and full test suite are maintained at [github.com/HarrisonJL/covenant-sentinel](https://github.com/HarrisonJL/covenant-sentinel), submitted separately under Intelligent Contracts.

**Live on GenLayer's Bradbury testnet. Testnet only - no real value anywhere in this project.**

## What it does

- Real-time facility status (current / breach / reporting default), pulled live from the contract.
- The covenant list (name, metric, comparison, threshold) and the full period history - every disclosure submitted, the exact figures every validator independently extracted from it, and the resulting pass/fail verdict.
- A wallet-gated `add_covenant` form for the lender (owner-only) and `submit_disclosure` form for the borrower (borrower-only), each showing live consensus status while a transaction is in flight - which validators are assigned, who's leading, and each validator's AGREE/DISAGREE as it's revealed.

## Contract

- **Address:** [`0x60989e9737295e17Dad7DD4AeEE47822634049B6`](https://explorer-bradbury.genlayer.com/address/0x60989e9737295e17Dad7DD4AeEE47822634049B6) on GenLayer Bradbury Testnet (chain id `4221`)
- **Source (included in this repo):** [`contract/covenant_sentinel.py`](contract/covenant_sentinel.py) - an exact mirror of the deployed contract, included directly here so the dashboard's `add_covenant` / `submit_disclosure` / `get_state` / `get_covenants` / `get_periods` calls can be verified against the real adjudication logic without leaving this repo.
- **Canonical source, design rationale, and full test suite:** [github.com/HarrisonJL/covenant-sentinel](https://github.com/HarrisonJL/covenant-sentinel) - that repo is the actual Intelligent Contracts submission and is where the contract is developed; this copy is kept in sync with it for the Project submission's own verifiability.
- Redeployed from the dashboard's original contract to add reporting-deadline replay protection - the previous address (`0x605cFCdc095D94951c0b9Ef16E769662Dd63253E`) is superseded.

## Development

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` needs `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_GENLAYER_CHAIN=bradbury` (see `.env.local.example`).

Stack: Next.js 16 + React 19 + Tailwind v4 + TypeScript via `genlayer-js`, wallet connect via plain EIP-1193 (`window.ethereum`).

## Known limitations

- **Testnet only.** No real value anywhere in this project.
- **Wallet click-through not tested end to end in a real browser extension** - the underlying `writeContract` calls this UI makes are proven correct (the exact same function names and argument shapes were exercised successfully against real Bradbury consensus via a standalone script), but there's no MetaMask-equivalent extension in the environment this was built in.
- See the [contract repo's own limitations](https://github.com/HarrisonJL/covenant-sentinel#known-limitations) for what the underlying contract does and doesn't handle (e.g. no cure/waiver path back from `breach`, single borrower per instance).
