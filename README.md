# Covenant Sentinel Dashboard

A lender/borrower dashboard for Covenant Sentinel, a [GenLayer](https://genlayer.com) Intelligent Contract for debt-covenant monitoring on tokenized RWA / private-credit facilities. This repo is the Project layer built on top of that contract - the contract source is included directly here (see Contract below) so the integration and adjudication behavior can be verified in this repo alone; the contract's own development history, design rationale, and full test suite are maintained at [github.com/HarrisonJL/covenant-sentinel](https://github.com/HarrisonJL/covenant-sentinel), submitted separately under Intelligent Contracts.

**Now points at Covenant Sentinel v2 on GenLayer Studio Next. Testnet only - no real value anywhere in this project.** (v1 on Bradbury is documented below for history; this dashboard talks to v2.)

## What it does

- Real-time facility status (current / breach / waived / reporting default), pulled live from the contract.
- The covenant list (name, metric, comparison, threshold, tolerance band) and the full period history - every disclosure submitted (pasted or fetched live from a URL), the exact figures every validator independently extracted from it, and the resulting Pass/Fail/**Inconclusive** verdict.
- **Waivers**: a borrower-facing "request waiver" form scoped to whichever covenant actually failed in the active breach period, a lender-facing grant/reject decision on each pending request, and a cure form once every failed covenant has been waived.
- An append-only **audit log** view - every state transition (submitted, breach, waiver requested/granted/rejected, waived, cured) in one place.
- Wallet-gated forms for the lender (`add_covenant`, waiver decisions) and the borrower (`submit_disclosure`/`submit_disclosure_url`, waiver requests, cure), each showing live consensus status while a transaction is in flight - which validators are assigned, who's leading, and each validator's AGREE/DISAGREE as it's revealed.

## Contract

- **Address:** [`0xeAfeD2A86317Db3Cd745ae2EbCB82549906bcDc7`](https://explorer-studio-dev.genlayer.com/address/0xeAfeD2A86317Db3Cd745ae2EbCB82549906bcDc7) on GenLayer Studio Next (chain id `61997`)
- **Source (included in this repo):** [`contract/covenant_sentinel_v2_studio_next.py`](contract/covenant_sentinel_v2_studio_next.py) - an exact mirror of the deployed contract, included directly here so the dashboard's calls can be verified against the real adjudication logic without leaving this repo. [`contract/covenant_sentinel.py`](contract/covenant_sentinel.py) (v1, Bradbury) is kept for history.
- **Canonical source, design rationale, and full test suite:** [github.com/HarrisonJL/covenant-sentinel](https://github.com/HarrisonJL/covenant-sentinel) - that repo is the actual Intelligent Contracts submission and is where the contract is developed; see its [`MILESTONE.md`](https://github.com/HarrisonJL/covenant-sentinel/blob/main/MILESTONE.md) for the v2 Milestone writeup (waiver/cure state machine, live disclosure fetch, tolerance-band validator) this dashboard now surfaces.

## Development

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` needs `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_GENLAYER_CHAIN=studionext` (see `.env.local.example`).

Stack: Next.js 16 + React 19 + Tailwind v4 + TypeScript via `genlayer-js` v2 (Studio Next's explicit-fees API), wallet connect via plain EIP-1193 (`window.ethereum`) with automatic network switching to chain `61997`.

## Known limitations

- **Testnet only.** No real value anywhere in this project.
- **Wallet click-through not tested end to end in a real browser extension** - the underlying `writeContract` calls this UI makes are proven correct (the exact same function names and argument shapes were exercised successfully against real Studio Next consensus via standalone scripts - see the contract repo's `MILESTONE.md`), but there's no MetaMask-equivalent extension in the environment this was built in. Read paths and every rendered state (including a live breach → waiver → cure cycle) were verified in a real browser against the live deployed contract.
- See the [contract repo's own limitations](https://github.com/HarrisonJL/covenant-sentinel#known-limitations-v1) (v1) and [`MILESTONE.md`](https://github.com/HarrisonJL/covenant-sentinel/blob/main/MILESTONE.md) (v2) for what the underlying contract does and doesn't handle (e.g. single borrower per instance).
