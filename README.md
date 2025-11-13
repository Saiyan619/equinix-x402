# Equinix x402 — Web3 Revenue-Sharing API Platform

Instant, trustless payment splitting for APIs using Solana’s x402 protocol

Built for the Corbits x402 Hackathon  
Demo Video — Coming Soon  
Live Demo — Coming Soon  

---

## The Problem

APIs today face major revenue-sharing bottlenecks that make collaboration between developers, creators, and platforms inefficient:

- No native payment splitting: revenue distribution takes days or weeks manually  
- High transaction fees: payment processors charge 2.9% + $0.30 per transaction  
- Centralized trust: one party must hold and redistribute funds manually  
- No micropayments: impossible to charge $0.01 per request due to minimum limits  
- Complex integrations: managing API keys, billing, and authentication adds friction  

Result: content creators, AI agents, and API providers cannot efficiently monetize or share revenue on a per-request basis.

---

## The Solution — Equinix x402

Equinix x402 leverages Solana’s x402 payment protocol and Anchor smart contracts to bring instant, atomic payment splitting to APIs.

It enables developers to integrate trustless, on-chain micropayments directly into their APIs, turning every HTTP request into a fair, automated revenue-sharing transaction.

---

## Key Features

- Atomic revenue splits — one transaction, multiple wallets paid instantly  
- x402 protocol ready — built on the HTTP 402 “Payment Required” standard  
- Micropayments — enable payments as low as $0.01 per request  
- Trustless and transparent — no middlemen, enforced by smart contracts  
- Instant settlement — payouts complete in about 400ms  
- Zero platform fees — only pay minimal Solana gas (~$0.00001)

---

## How It Works

### 1. Create a Splitter

Define who gets paid and how much.

```js
const splitter = {
  merchant: "Merchant_Wallet_Address",
  agent: "Agent_Wallet_Address", 
  platform: "Platform_Wallet_Address",
  merchantShare: 70,
  agentShare: 20,
  platformShare: 10
};

2. Client Requests a Protected Endpoint
POST /api/demo/get-data
{ "splitterPDA": "BqMPKN..." }

3. Server Responds with a 402 Payment Request
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "solana-devnet",
    "maxAmountRequired": "10000",
    "payTo": "BqMPKN...",
    "asset": "4zMMC9...",
    "description": "Premium API access with payment splitting"
  }]
}

4. Client Pays via Smart Contract
One on-chain transaction automatically:

Sends 0.007 USDC to the Merchant (70%)

Sends 0.002 USDC to the Agent (20%)

Sends 0.001 USDC to the Platform (10%)
All within a single atomic payment on Solana.

5. Client Retries with Payment Proof
POST /api/demo/get-data
Headers:
x-payment-signature: "NtSQ3RG..."
x-payer-address: "8NXbUF..."

6. Server Verifies & Returns Data
{
  "success": true,
  "data": {
    "message": "Payment successful! Here is your premium data.",
    "splits": {
      "merchant": "70% (0.007 USDC) → 99boA23...",
      "agent": "20% (0.002 USDC) → CgMGP57...",
      "platform": "10% (0.001 USDC) → 65rSM9v..."
    },
    "demoData": { ... }
  }
}

Architecture Overview
┌─────────────┐          ┌──────────────┐          ┌─────────────┐
│   Client    │  1. GET  │   API Server │          │   Solana    │
│  (Payer)    │─────────>│  (Express)   │          │ Blockchain  │
└─────────────┘          └──────────────┘          └─────────────┘
       │                        │                           │
       │   2. 402 Payment Req   │                           │
       │<───────────────────────│                           │
       │                        │                           │
       │   3. Build Split TX    │                           │
       │───────────────────────>│                           │
       │                        │                           │
       │   4. Sign & Send TX    │──────────────────────────>│
       │                        │   (Anchor Program)        │
       │                        │   Splits payment 3-ways   │
       │                        │                           │
       │   5. Retry w/ Proof    │──────────────────────────>│
       │                        │   6. Verify On-Chain      │
       │                        │<──────────────────────────│
       │   7. Return Data       │                           │
       │<───────────────────────│                           │

Tech Stack

Frontend: React, TypeScript, Solana Wallet Adapter
Backend: Node.js, Express, MongoDB
Blockchain: Solana Devnet, Anchor Framework
Payment Protocol: x402 (HTTP 402) via @faremeter/info
Smart Contract: Rust + Anchor (on-chain payment splitting)

Live Demo

Transaction (Devnet): Coming Soon
Demo Video: Coming Soon

What happens in one click:

Payer sends 0.01 USDC

Merchant receives 0.007 USDC

Agent receives 0.002 USDC

Platform receives 0.001 USDC

All processed atomically within ~400ms

Use Cases
AI Agent Marketplaces
Agent Creator: 70%
Platform: 20%
Infrastructure: 10%

Data Providers
Data Provider: 80%
API Host: 15%
Network Fees: 5%

Gaming APIs
Game Developer: 50%
Asset Creator: 30%
Platform: 20%

Vision

Equinix x402 redefines how APIs get paid — moving from centralized billing systems to decentralized, programmable revenue flows.
Imagine a world where every API request is its own micro-economy, and developers, creators, and AI agents get paid instantly.

That’s Equinix x402 — the next era of Web3-native APIs.

Local Setup
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev

# Terminal 3 — Client Example
cd client-example
npm start
