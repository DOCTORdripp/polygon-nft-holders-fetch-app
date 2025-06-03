const ALCHEMY_BASE = "https://polygon-mainnet.g.alchemy.com/nft/v2/" 
                  + process.env.ALCHEMY_API_KEY 
                  + "/getOwnersForCollection";

export default async function handler(req, res) {
  // Debug: Check if API key is loaded
  console.log("ALCHEMY_API_KEY:", process.env.ALCHEMY_API_KEY ? "LOADED" : "NOT LOADED");
  console.log("Full URL:", ALCHEMY_BASE);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { contracts } = req.body;
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return res.status(400).json({ error: "Must include a non‐empty array `contracts`." });
  }

  // Deduplicate and lowercase all contract addresses
  const uniqueContracts = Array.from(new Set(
    contracts.map(c => (c || "").trim().toLowerCase())
  )).filter(c => c !== "");

  // combinedTotals: { walletAddress: totalItemsAcrossAllContracts }
  const combinedTotals = {};
  
  // collectionBreakdown: { walletAddress: { contractAddress: itemCount } }
  const collectionBreakdown = {};

  for (const contract of uniqueContracts) {
    let pageKey = null;
    while (true) {
      const params = new URLSearchParams({
        contractAddress: contract,
        withTokenBalances: "true",
        limit: "100"
      });
      if (pageKey) params.set("pageKey", pageKey);

      const url = `${ALCHEMY_BASE}?${params.toString()}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        // If Alchemy returns an error, bail out early with a descriptive message
        const text = await resp.text();
        return res.status(500).json({
          error: `Alchemy error for contract ${contract}: ${resp.status} ${text}`
        });
      }
      const data = await resp.json();

      // Iterate each owner in "ownerAddresses"
      for (const ownerEntry of data.ownerAddresses || []) {
        const ownerAddr = ownerEntry.ownerAddress;
        if (!ownerAddr) continue;

        // Sum all balances for every tokenId that owner holds
        let sumForThisContract = 0;
        for (const tb of ownerEntry.tokenBalances || []) {
          // Alchemy's "balance" is already a number
          sumForThisContract += Number(tb.balance || 0);
        }
        
        if (sumForThisContract > 0) {
          // Update combined totals
          combinedTotals[ownerAddr] = (combinedTotals[ownerAddr] || 0) 
                                     + sumForThisContract;
          
          // Update collection breakdown
          if (!collectionBreakdown[ownerAddr]) {
            collectionBreakdown[ownerAddr] = {};
          }
          collectionBreakdown[ownerAddr][contract] = sumForThisContract;
        }
      }

      pageKey = data.pageKey;
      if (!pageKey) break;
    }
  }

  // Convert to sorted array and add collection ownership info
  const sorted = Object.entries(combinedTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([wallet, total]) => {
      const ownedCollections = Object.keys(collectionBreakdown[wallet] || {}).length;
      const collectionsOwned = `${ownedCollections}/${uniqueContracts.length}`;
      
      return { 
        wallet, 
        total, 
        collectionsOwned,
        breakdown: collectionBreakdown[wallet] || {}
      };
    });

  return res.status(200).json({ 
    result: sorted, 
    contracts: uniqueContracts,
    totalContracts: uniqueContracts.length
  });
} 