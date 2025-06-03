# Polygon NFT Holders Fetch App

## 🌟 **LIVE DEMO** 🌟

### **✨ [TRY IT NOW: https://hodlers.doctordripp.com/](https://hodlers.doctordripp.com/) ✨**

🚀 **Full-featured NFT hodler analytics tool with rainbow UI, CSV export, and donation support!** 🚀

---

A Next.js application that fetches and aggregates NFT holder data from multiple Polygon contracts using the Alchemy API.

## Features

- Input multiple Polygon NFT contract addresses
- Fetch holder data for each contract using Alchemy's API
- Aggregate total items held per wallet across all contracts
- Display results in a sortable table
- Copy-friendly output format

## Project Structure

```
polygon-nft-holders-fetch-app/
├── pages/
│   ├── index.js          # Frontend UI
│   └── api/
│       └── holders.js    # Serverless API that calls Alchemy
├── package.json
├── .env.local           # Environment variables (not committed)
└── README.md
```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   The `.env.local` file has been created with your Alchemy API key. Make sure it contains:
   ```
   ALCHEMY_API_KEY=your_api_key_here
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. Paste one or more Polygon NFT contract addresses in the textarea (one per line or comma-separated)
2. Click "Fetch holders" to retrieve holder data
3. View the results showing each wallet address and their total items across all contracts
4. Copy the table data as needed

## API Endpoint

The app includes a serverless API endpoint at `/api/holders` that:

- Accepts POST requests with a JSON body containing an array of contract addresses
- Calls Alchemy's `getOwnersForCollection` API for each contract
- Aggregates holder data across all contracts
- Returns a sorted list of wallets and their total holdings

### Example API Usage

```javascript
const response = await fetch('/api/holders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contracts: [
      '0x4bac5fa12b0dcf7cc9e52fd5afd4990c239c00be',
      '0x8152feb2c4ef95059e2eca365a4fe5b3006ad9b9'
    ]
  })
});

const data = await response.json();
```

## Deployment

This app is ready to be deployed on Vercel or any other Next.js-compatible platform. The environment variable `ALCHEMY_API_KEY` will be automatically picked up during deployment.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server 