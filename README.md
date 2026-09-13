# Covenant Sentinel Dashboard

A lender/borrower dashboard for [Covenant Sentinel](https://github.com/HarrisonJL/covenant-sentinel), a [GenLayer](https://genlayer.com) Intelligent Contract for debt-covenant monitoring on tokenized RWA / private-credit facilities. This repo is the Project layer built on top of that already-submitted contract - the contract itself, its design rationale, and its own submission live in the linked repo.

**Live on GenLayer's Bradbury testnet. Testnet only - no real value anywhere in this project.**

## What it does

- Real-time facility status (current / breach / reporting default), pulled live from the contract.
- The covenant list (name, metric, comparison, threshold) and the full period history - every disclosure submitted, the exact figures every validator independently extracted from it, and the resulting pass/fail verdict.
- A wallet-gated `add_covenant` form for the lender (owner-only) and `submit_disclosure` form for the borrower (borrower-only), each showing live consensus status while a transaction is in flight - which validators are assigned, who's leading, and each validator's AGREE/DISAGREE as it's revealed.

## Contract

- **Address:** [`0x605cFCdc095D94951c0b9Ef16E769662Dd63253E`](https://explorer-bradbury.genlayer.com/address/0x605cFCdc095D94951c0b9Ef16E769662Dd63253E) on GenLayer Bradbury Testnet (chain id `4221`)
- **Source, design rationale, and tests:** [github.com/HarrisonJL/covenant-sentinel](https://github.com/HarrisonJL/covenant-sentinel)
- The live instance already has one real covenant (`min_dscr`, DSCR ≥ 1.25x) and one real disclosure submitted and passed through actual validator consensus - not seeded with mock data.

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
