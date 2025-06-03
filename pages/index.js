import { useState } from "react";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hodlers, setHodlers] = useState(null);
  const [error, setError] = useState("");
  const [contracts, setContracts] = useState([]);
  const [totalContracts, setTotalContracts] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  
  // Modal and Captcha state
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const [pendingContracts, setPendingContracts] = useState([]);

  // Generate simple math captcha
  function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    const question = `${num1} ${operator} ${num2}`;
    const answer = operator === '+' ? num1 + num2 : num1 - num2;
    
    return { question, answer };
  }

  // Function to extract contract address from various URL formats
  const extractContractAddress = (text) => {
    const trimmedText = text.trim();
    
    // Direct contract address (0x followed by 40 hex characters)
    const directAddressMatch = trimmedText.match(/^(0x[a-fA-F0-9]{40})$/);
    if (directAddressMatch) {
      return directAddressMatch[1];
    }
    
    // DCL Marketplace URL: https://decentraland.org/marketplace/contracts/{address}/items/*
    const dclMatch = trimmedText.match(/decentraland\.org\/marketplace\/contracts\/(0x[a-fA-F0-9]{40})/i);
    if (dclMatch) {
      return dclMatch[1];
    }
    
    // Polygonscan URL: https://polygonscan.com/address/{address}
    const polygonscanMatch = trimmedText.match(/polygonscan\.com\/address\/(0x[a-fA-F0-9]{40})/i);
    if (polygonscanMatch) {
      return polygonscanMatch[1];
    }
    
    // If no pattern matches, return null
    return null;
  };

  // CSV Export functionality
  const exportToCSV = (data, filename = 'polygon-hodlers.csv') => {
    if (!data || data.length === 0) return;
    
    // Create CSV content with enhanced columns
    const baseHeaders = ['Rank', 'Wallet Address', 'DCL Profile'];
    
    // Add Collections Owned columns if multiple contracts
    if (totalContracts > 1) {
      baseHeaders.push('Collections Owned', 'Total Collections');
    }
    
    baseHeaders.push('Total Items');
    
    // Add individual contract columns for breakdown
    const contractHeaders = contracts.map(contract => `Contract ${contract.substring(0, 6)}...${contract.substring(38)}`);
    const allHeaders = [...baseHeaders, ...contractHeaders];
    
    const csvContent = [
      allHeaders.join(','),
      ...data.map((item, index) => {
        const baseRow = [
          index + 1,
          `"${item.wallet}"`,
          `"https://decentraland.org/marketplace/accounts/${item.wallet}"`
        ];
        
        // Add collections owned columns if multiple contracts
        if (totalContracts > 1) {
          const ownedCount = Object.keys(item.breakdown || {}).length;
          baseRow.push(ownedCount, totalContracts);
        }
        
        baseRow.push(item.total);
        
        // Add breakdown columns
        const breakdownRow = contracts.map(contract => 
          item.breakdown && item.breakdown[contract] ? item.breakdown[contract] : 0
        );
        
        return [...baseRow, ...breakdownRow].join(',');
      })
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setHodlers(null);

    // Parse input: one address/URL per line, or comma/space separated
    const lines = input
      .split(/\s|,|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (lines.length === 0) {
      setError("Please enter at least one contract address or URL.");
      return;
    }

    // Extract contract addresses from various formats
    const contractAddresses = [];
    const invalidInputs = [];

    for (const line of lines) {
      const contractAddress = extractContractAddress(line);
      if (contractAddress) {
        contractAddresses.push(contractAddress);
      } else if (line.length > 10) { // Only flag longer strings as potentially invalid
        invalidInputs.push(line.substring(0, 50) + (line.length > 50 ? "..." : ""));
      }
    }

    if (contractAddresses.length === 0) {
      setError("No valid contract addresses or URLs found. Please check your input format.");
      return;
    }

    // Show warning for invalid inputs but continue with valid ones
    if (invalidInputs.length > 0) {
      console.warn("Could not parse the following inputs:", invalidInputs);
    }

    // Store contracts and show captcha modal
    setPendingContracts(contractAddresses);
    setShowCaptchaModal(true);
    setCaptcha(generateCaptcha()); // Generate fresh captcha
    setCaptchaInput("");
  };

  const handleCaptchaSubmit = async () => {
    // Validate captcha
    const captchaAnswer = parseInt(captchaInput.trim());
    if (isNaN(captchaAnswer) || captchaAnswer !== captcha.answer) {
      setError("❌ Captcha incorrect. Please solve the math problem correctly.");
      setCaptcha(generateCaptcha()); // Generate new captcha
      setCaptchaInput("");
      return;
    }

    // Close modal and proceed with API call
    setShowCaptchaModal(false);
    setLoading(true);

    try {
      const resp = await fetch("/api/holders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contracts: pendingContracts }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Unknown server error");
      }
      const { result, contracts: responseContracts, totalContracts: responseTotalContracts } = await resp.json();
      setHodlers(result);
      setContracts(responseContracts || []);
      setTotalContracts(responseTotalContracts || 0);
      
      // Reset states
      setCaptchaInput("");
      setError("");
      
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setPendingContracts([]);
    }
  };

  const closeCaptchaModal = () => {
    setShowCaptchaModal(false);
    setCaptchaInput("");
    setPendingContracts([]);
    setError("");
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0d1a 15%, #0d0d1a 30%, #1a0d0d 45%, #0d1a0d 60%, #1a1a0d 75%, #1a0d1a 90%, #0a0a0a 100%);
          min-height: 100vh;
          color: #ffffff;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow-x: hidden;
          position: relative;
        }
        
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 300%;
          height: 300%;
          background: 
            linear-gradient(45deg, transparent 30%, rgba(255, 0, 128, 0.03) 35%, rgba(255, 0, 128, 0.08) 40%, transparent 45%),
            linear-gradient(-45deg, transparent 30%, rgba(0, 255, 128, 0.03) 35%, rgba(0, 255, 128, 0.08) 40%, transparent 45%),
            linear-gradient(90deg, transparent 30%, rgba(128, 0, 255, 0.03) 35%, rgba(128, 0, 255, 0.08) 40%, transparent 45%),
            linear-gradient(0deg, transparent 30%, rgba(255, 128, 0, 0.03) 35%, rgba(255, 128, 0, 0.08) 40%, transparent 45%);
          pointer-events: none;
          z-index: -2;
          animation: scroll-bg 20s linear infinite;
        }
        
        body::after {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: 
            radial-gradient(circle at 20% 50%, rgba(255, 20, 147, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(0, 191, 255, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(50, 205, 50, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 60% 60%, rgba(255, 165, 0, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 30% 30%, rgba(138, 43, 226, 0.1) 0%, transparent 50%);
          pointer-events: none;
          z-index: -1;
        }
        
        @keyframes scroll-bg {
          0% { transform: translate(-33%, -33%) rotate(0deg); }
          100% { transform: translate(-33%, -33%) rotate(360deg); }
        }
        
        @keyframes rainbowBG {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .rainbowBtn {
          animation: rainbowBG 3s linear infinite;
          background: linear-gradient(90deg, red, #ff9a00, #d0de21, #4fdc4a, #3fdad8, #2fc9e2, #1c7fee, #5f15f2, #ba0cf8, #fb07d9, red, #ff9a00);
          background-size: 800% auto;
          border: none;
          border-radius: 1rem;
          color: #fff;
          cursor: pointer;
          font-size: 1rem;
          padding: .75rem 1.5rem;
          transition: all .3s ease;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 255, 255, 0.1);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
        }
        
        .rainbowBtn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4), 0 0 30px rgba(255, 255, 255, 0.2);
        }
        
        .rainbowBtn:active {
          transform: translateY(0px);
        }
        
        .glow {
          filter: drop-shadow(0 0 15px rgba(255, 20, 147, 0.6));
        }
        
        .card-glow {
          box-shadow: 
            0 4px 25px rgba(0, 0, 0, 0.4),
            0 0 50px rgba(255, 20, 147, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        
        .neon-border {
          border: 1px solid transparent;
          background: linear-gradient(135deg, rgba(255, 20, 147, 0.2), rgba(0, 191, 255, 0.2), rgba(50, 205, 50, 0.2)) border-box;
          border-radius: 12px;
        }
        
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 25px rgba(255, 20, 147, 0.4); }
          50% { box-shadow: 0 0 35px rgba(0, 191, 255, 0.6), 0 0 45px rgba(50, 205, 50, 0.3); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        @keyframes rainbow-text {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .rainbow-text {
          background: linear-gradient(45deg, #ff1744, #ff9800, #ffeb3b, #4caf50, #2196f3, #9c27b0, #e91e63, #ff1744);
          background-size: 400% 400%;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          animation: rainbow-text 3s ease-in-out infinite;
        }
        
        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid transparent;
          border-top: 2px solid #ff1744;
          border-right: 2px solid #2196f3;
          border-bottom: 2px solid #4caf50;
          border-left: 2px solid #ff9800;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Hide number input spinners */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      
      <div style={{
        minHeight: '100vh',
        padding: '2rem',
        background: 'transparent',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 2,
        }}>
          {/* Hero Section */}
          <div className="animate-float" style={{
            textAlign: 'center',
            marginBottom: '3rem',
            position: 'relative',
            zIndex: 3,
          }}>
            <h1 className="rainbow-text" style={{
              fontFamily: 'Inter',
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: '900',
              textShadow: '0 0 30px rgba(255, 20, 147, 0.8), 0 0 60px rgba(0, 191, 255, 0.5)',
              marginBottom: '1rem',
              letterSpacing: '2px',
              position: 'relative',
              zIndex: 4,
            }}>
              POLYGON CONTRACT HODLERS TOOL
            </h1>
            <p style={{
              fontSize: '1.2rem',
              color: '#e0e6ed',
              fontWeight: '300',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
              position: 'relative',
              zIndex: 4,
            }}>
              Elite NFT Hodler Analytics & Intelligence
            </p>
          </div>

          {/* Main Card */}
          <div className="card-glow neon-border" style={{
            background: 'linear-gradient(135deg, rgba(10, 15, 25, 0.95), rgba(15, 10, 20, 0.9))',
            borderRadius: '20px',
            padding: '2.5rem',
            backdropFilter: 'blur(25px)',
            border: '2px solid rgba(255, 20, 147, 0.3)',
            marginBottom: '2rem',
            position: 'relative',
            zIndex: 2,
          }}>
            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '1rem',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#ff1744',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  textShadow: '0 0 15px rgba(255, 23, 68, 0.5)',
                }}>
                  🎯 COLLECTION ADDRESS PARSER
                </label>
                <div style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, rgba(255, 20, 147, 0.08), rgba(0, 191, 255, 0.08), rgba(50, 205, 50, 0.08))',
                  border: '1px solid rgba(255, 20, 147, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  color: '#b8c5d1',
                }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: '600', color: '#00bfff' }}>
                    ✨ Supports multiple formats:
                  </div>
                  <div>📝 Direct addresses: <code style={{ color: '#ff1744', backgroundColor: 'rgba(255, 23, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>0x4bac5fa12b0dcf7cc9e52fd5afd4990c239c00be</code></div>
                  <div>🌐 DCL Marketplace: <code style={{ color: '#ffeb3b', backgroundColor: 'rgba(255, 235, 59, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>decentraland.org/marketplace/contracts/0x.../items/0</code></div>
                  <div>🔍 Polygonscan: <code style={{ color: '#4caf50', backgroundColor: 'rgba(76, 175, 80, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>polygonscan.com/address/0x...</code></div>
                </div>
                <textarea
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '1.5rem',
                    fontSize: '0.95rem',
                    fontFamily: 'Fira Code, monospace',
                    background: 'linear-gradient(135deg, rgba(5, 10, 20, 0.9), rgba(10, 5, 15, 0.95))',
                    border: '2px solid rgba(255, 20, 147, 0.4)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    boxShadow: 'inset 0 2px 15px rgba(0, 0, 0, 0.5)',
                  }}
                  placeholder={`Paste Polygon collection addresses to analyze combined hodler statistics.

One per line or comma separated - any format supported above.`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#ff1744';
                    e.target.style.boxShadow = '0 0 25px rgba(255, 23, 68, 0.4), inset 0 2px 15px rgba(0, 0, 0, 0.5)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 20, 147, 0.4)';
                    e.target.style.boxShadow = 'inset 0 2px 15px rgba(0, 0, 0, 0.5)';
                  }}
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className={loading ? "" : "rainbowBtn"}
                style={{
                  width: '100%',
                  padding: '1rem 2rem',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  fontFamily: 'Inter',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  ...(loading && {
                    background: 'linear-gradient(135deg, rgba(60, 60, 60, 0.8), rgba(80, 80, 80, 0.8))',
                  }),
                  color: loading ? '#cccccc' : '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: loading 
                    ? '0 4px 15px rgba(0, 0, 0, 0.3)'
                    : '0 4px 20px rgba(255, 23, 68, 0.5), 0 0 30px rgba(33, 150, 243, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  textShadow: loading ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.8)',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 30px rgba(255, 23, 68, 0.7), 0 0 40px rgba(33, 150, 243, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(0px)';
                    e.target.style.boxShadow = '0 4px 20px rgba(255, 23, 68, 0.5), 0 0 30px rgba(33, 150, 243, 0.3)';
                  }
                }}
              >
                {loading && <div className="loading-spinner"></div>}
                {loading ? "ANALYZING..." : "🚀 FETCH HODLERS"}
              </button>
            </form>
          </div>

          {/* Error/Success Message */}
          {error && (
            <div style={{
              background: error.startsWith('✅') 
                ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.25), rgba(33, 150, 243, 0.25))'
                : 'linear-gradient(135deg, rgba(255, 23, 68, 0.25), rgba(255, 152, 0, 0.25))',
              border: error.startsWith('✅')
                ? '2px solid rgba(76, 175, 80, 0.6)'
                : '2px solid rgba(255, 23, 68, 0.6)',
              borderRadius: '12px',
              padding: '1rem 1.5rem',
              marginBottom: '2rem',
              color: error.startsWith('✅') ? '#4caf50' : '#ff1744',
              fontWeight: '600',
              textAlign: 'center',
              boxShadow: error.startsWith('✅')
                ? '0 4px 25px rgba(76, 175, 80, 0.3)'
                : '0 4px 25px rgba(255, 23, 68, 0.3)',
              backdropFilter: 'blur(15px)',
            }}>
              {error.startsWith('✅') ? '' : '⚠️ '}{error}
            </div>
          )}

          {/* Results Section */}
          {hodlers && hodlers.length > 0 && (
            <div className="card-glow neon-border" style={{
              background: 'linear-gradient(135deg, rgba(10, 15, 25, 0.95), rgba(15, 10, 20, 0.9))',
              borderRadius: '20px',
              padding: '2.5rem',
              backdropFilter: 'blur(25px)',
              border: '2px solid rgba(255, 20, 147, 0.3)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '1rem',
              }}>
                <h2 style={{
                  fontFamily: 'Inter',
                  fontSize: '1.8rem',
                  fontWeight: '700',
                  color: '#ff1744',
                  textShadow: '0 0 15px rgba(255, 23, 68, 0.5)',
                  letterSpacing: '1px',
                  margin: 0,
                }}>
                  🏆 ELITE HODLERS LEADERBOARD
                </h2>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {totalContracts > 1 && (
                    <button
                      className="rainbowBtn"
                      onClick={() => setShowBreakdown(!showBreakdown)}
                      style={{
                        fontSize: '0.9rem',
                        padding: '0.5rem 1rem',
                      }}
                    >
                      📊 {showBreakdown ? 'HIDE' : 'SHOW'} BREAKDOWN
                    </button>
                  )}
                  <button
                    className="rainbowBtn"
                    onClick={() => exportToCSV(hodlers, `polygon-hodlers-${new Date().toISOString().split('T')[0]}.csv`)}
                    style={{
                      fontSize: '0.9rem',
                      padding: '0.5rem 1rem',
                    }}
                  >
                    📊 EXPORT ALL
                  </button>
                </div>
              </div>
              
              <div style={{ 
                overflowX: 'auto',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(5, 10, 20, 0.8), rgba(10, 5, 15, 0.9))',
                border: '1px solid rgba(255, 20, 147, 0.3)',
              }}>
                {!showBreakdown ? (
                  // Main Leaderboard Table
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontFamily: 'Fira Code, monospace',
                    fontSize: '0.9rem',
                  }}>
                    <thead>
                      <tr style={{
                        background: 'linear-gradient(135deg, rgba(255, 23, 68, 0.15), rgba(33, 150, 243, 0.15), rgba(255, 235, 59, 0.15))',
                        borderBottom: '2px solid rgba(255, 23, 68, 0.4)',
                      }}>
                        <th style={{
                          textAlign: 'left',
                          padding: '1rem 1.5rem',
                          color: '#ff1744',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          width: '60%',
                          textShadow: '0 0 10px rgba(255, 23, 68, 0.3)',
                        }}>
                          👤 Wallet Address
                        </th>
                        {totalContracts > 1 && (
                          <th style={{
                            textAlign: 'center',
                            padding: '1rem 1rem',
                            color: '#4caf50',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            width: '15%',
                            textShadow: '0 0 10px rgba(76, 175, 80, 0.3)',
                          }}>
                            📊 Collections Owned
                          </th>
                        )}
                        <th style={{
                          textAlign: 'center',
                          padding: '1rem 1rem',
                          color: '#ffeb3b',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          width: '15%',
                          textShadow: '0 0 10px rgba(255, 235, 59, 0.3)',
                        }}>
                          🌐 DCL Profile
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '1rem 1.5rem',
                          color: '#2196f3',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          width: '25%',
                          textShadow: '0 0 10px rgba(33, 150, 243, 0.3)',
                        }}>
                          💎 Total Items
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {hodlers.map(({ wallet, total, collectionsOwned, breakdown }, index) => (
                        <tr 
                          key={wallet} 
                          style={{
                            borderBottom: '1px solid rgba(255, 20, 147, 0.15)',
                            transition: 'all 0.3s ease',
                            background: index < 3 
                              ? `linear-gradient(135deg, rgba(255, 23, 68, ${0.08 + (3-index) * 0.04}), rgba(33, 150, 243, ${0.05 + (3-index) * 0.03}), rgba(255, 235, 59, ${0.03 + (3-index) * 0.02}))`
                              : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 23, 68, 0.15), rgba(33, 150, 243, 0.08), rgba(255, 235, 59, 0.08))';
                            e.currentTarget.style.transform = 'scale(1.01)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = index < 3 
                              ? `linear-gradient(135deg, rgba(255, 23, 68, ${0.08 + (3-index) * 0.04}), rgba(33, 150, 243, ${0.05 + (3-index) * 0.03}), rgba(255, 235, 59, ${0.03 + (3-index) * 0.02}))`
                              : 'transparent';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <td style={{
                            padding: '1rem 1.5rem',
                            color: '#ffffff',
                            fontFamily: 'Fira Code, monospace',
                            wordBreak: 'break-all',
                          }}>
                            {index < 3 && (
                              <span style={{
                                marginRight: '0.5rem',
                                fontSize: '1.2rem',
                              }}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                              </span>
                            )}
                            {wallet}
                          </td>
                          {totalContracts > 1 && (
                            <td style={{
                              padding: '1rem 1rem',
                              textAlign: 'center',
                              color: '#4caf50',
                              fontWeight: '600',
                              fontSize: '1rem',
                              textShadow: '0 0 8px rgba(76, 175, 80, 0.3)',
                            }}>
                              {collectionsOwned}
                            </td>
                          )}
                          <td style={{
                            padding: '1rem 1.5rem',
                            textAlign: 'center',
                          }}>
                            <a
                              href={`https://decentraland.org/marketplace/accounts/${wallet}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '1.5rem',
                                textDecoration: 'none',
                                color: '#ffeb3b',
                                transition: 'all 0.3s ease',
                                textShadow: '0 0 8px rgba(255, 235, 59, 0.3)',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.transform = 'scale(1.2)';
                                e.target.style.textShadow = '0 0 15px rgba(255, 235, 59, 0.8)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.transform = 'scale(1)';
                                e.target.style.textShadow = '0 0 8px rgba(255, 235, 59, 0.3)';
                              }}
                              title={`View ${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)} on Decentraland`}
                            >
                              🌐
                            </a>
                          </td>
                          <td style={{
                            padding: '1rem 1.5rem',
                            textAlign: 'right',
                            color: '#2196f3',
                            fontWeight: '600',
                            fontSize: '1rem',
                            textShadow: '0 0 8px rgba(33, 150, 243, 0.3)',
                          }}>
                            {total.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  // Collection Breakdown Table
                  <div>
                    <div style={{
                      textAlign: 'center',
                      padding: '1.5rem',
                      background: 'linear-gradient(135deg, rgba(255, 23, 68, 0.15), rgba(33, 150, 243, 0.15), rgba(255, 235, 59, 0.15))',
                      borderBottom: '2px solid rgba(255, 23, 68, 0.4)',
                    }}>
                      <h3 style={{
                        fontFamily: 'Inter',
                        fontSize: '1.3rem',
                        fontWeight: '700',
                        color: '#ff1744',
                        textShadow: '0 0 15px rgba(255, 23, 68, 0.5)',
                        letterSpacing: '1px',
                        margin: 0,
                      }}>
                        📊 COLLECTION BREAKDOWN MATRIX
                      </h3>
                    </div>
                    
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontFamily: 'Fira Code, monospace',
                        fontSize: '0.8rem',
                      }}>
                        <thead>
                          <tr style={{
                            background: 'linear-gradient(135deg, rgba(255, 23, 68, 0.1), rgba(33, 150, 243, 0.1), rgba(255, 235, 59, 0.1))',
                            borderBottom: '1px solid rgba(255, 23, 68, 0.3)',
                          }}>
                            <th style={{
                              textAlign: 'left',
                              padding: '0.75rem 1rem',
                              color: '#ff1744',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                              minWidth: '200px',
                              textShadow: '0 0 10px rgba(255, 23, 68, 0.3)',
                            }}>
                              👤 Wallet
                            </th>
                            {contracts.map((contract, index) => (
                              <th key={contract} style={{
                                textAlign: 'center',
                                padding: '0.75rem 0.5rem',
                                color: index % 3 === 0 ? '#ffeb3b' : index % 3 === 1 ? '#4caf50' : '#2196f3',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                minWidth: '120px',
                                textShadow: `0 0 10px ${index % 3 === 0 ? 'rgba(255, 235, 59, 0.3)' : index % 3 === 1 ? 'rgba(76, 175, 80, 0.3)' : 'rgba(33, 150, 243, 0.3)'}`,
                                fontSize: '0.7rem',
                              }}>
                                🏷️ {contract.substring(0, 6)}...{contract.substring(38)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {hodlers.map(({ wallet, breakdown }, index) => (
                            <tr 
                              key={wallet}
                              style={{
                                borderBottom: '1px solid rgba(255, 20, 147, 0.15)',
                                transition: 'all 0.3s ease',
                                background: index < 3 
                                  ? `linear-gradient(135deg, rgba(255, 23, 68, ${0.05 + (3-index) * 0.02}), rgba(33, 150, 243, ${0.03 + (3-index) * 0.02}), rgba(255, 235, 59, ${0.02 + (3-index) * 0.01}))`
                                  : 'transparent',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 23, 68, 0.1), rgba(33, 150, 243, 0.05), rgba(255, 235, 59, 0.05))';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = index < 3 
                                  ? `linear-gradient(135deg, rgba(255, 23, 68, ${0.05 + (3-index) * 0.02}), rgba(33, 150, 243, ${0.03 + (3-index) * 0.02}), rgba(255, 235, 59, ${0.02 + (3-index) * 0.01}))`
                                  : 'transparent';
                              }}
                            >
                              <td style={{
                                padding: '0.75rem 1rem',
                                color: '#ffffff',
                                fontFamily: 'Fira Code, monospace',
                                wordBreak: 'break-all',
                                fontSize: '0.75rem',
                              }}>
                                {index < 3 && (
                                  <span style={{
                                    marginRight: '0.5rem',
                                    fontSize: '1rem',
                                  }}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                  </span>
                                )}
                                {wallet.substring(0, 8)}...{wallet.substring(34)}
                              </td>
                              {contracts.map((contract, contractIndex) => {
                                const hasItems = breakdown && breakdown[contract] && breakdown[contract] > 0;
                                const itemCount = hasItems ? breakdown[contract] : 0;
                                return (
                                  <td key={contract} style={{
                                    padding: '0.75rem 0.5rem',
                                    textAlign: 'center',
                                    color: hasItems ? '#4caf50' : '#666666',
                                    fontWeight: hasItems ? '700' : '400',
                                    fontSize: '0.8rem',
                                    textShadow: hasItems ? '0 0 8px rgba(76, 175, 80, 0.3)' : 'none',
                                  }}>
                                    {hasItems ? `✅ ${itemCount}` : '❌'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div style={{
                      padding: '1rem',
                      textAlign: 'center',
                      color: '#9ca3af',
                      fontSize: '0.8rem',
                      fontStyle: 'italic',
                      background: 'linear-gradient(135deg, rgba(5, 10, 20, 0.5), rgba(10, 5, 15, 0.6))',
                    }}>
                      ✅ = Owns items in collection • ❌ = No items • Numbers show item count
                    </div>
                  </div>
                )}
              </div>
              
              <div style={{
                marginTop: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}>
                <div style={{
                  color: '#9ca3af',
                  fontSize: '0.9rem',
                  fontStyle: 'italic',
                }}>
                  ✨ Data aggregated across all contracts • Ready to copy and analyze
                </div>
                <button
                  className="rainbowBtn"
                  onClick={() => exportToCSV(hodlers, `polygon-hodlers-leaderboard-${new Date().toISOString().split('T')[0]}.csv`)}
                  style={{
                    fontSize: '0.9rem',
                    padding: '0.5rem 1rem',
                  }}
                >
                  📥 EXPORT TO CSV
                </button>
              </div>
            </div>
          )}

          {hodlers && hodlers.length === 0 && (
            <div className="card-glow" style={{
              background: 'linear-gradient(135deg, rgba(10, 15, 25, 0.95), rgba(15, 10, 20, 0.9))',
              borderRadius: '20px',
              padding: '3rem',
              textAlign: 'center',
              border: '2px solid rgba(255, 20, 147, 0.3)',
              backdropFilter: 'blur(25px)',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
              <h3 style={{
                color: '#9ca3af',
                fontSize: '1.2rem',
                fontWeight: '400',
              }}>
                No hodlers found for the provided contracts
              </h3>
            </div>
          )}
        </div>

        {/* Donation Section */}
        <div className="card-glow neon-border" style={{
          background: 'linear-gradient(135deg, rgba(10, 15, 25, 0.95), rgba(15, 10, 20, 0.9))',
          borderRadius: '20px',
          padding: '2rem',
          backdropFilter: 'blur(25px)',
          border: '2px solid rgba(255, 20, 147, 0.3)',
          marginTop: '2rem',
          maxWidth: '900px',
          margin: '2rem auto 0 auto',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💎</div>
            <h3 className="rainbow-text" style={{
              fontFamily: 'Inter',
              fontSize: '1.5rem',
              fontWeight: '700',
              letterSpacing: '1px',
              marginBottom: '1rem',
            }}>
              SUPPORT DEVELOPMENT
            </h3>
            <p style={{
              color: '#9ca3af',
              fontSize: '1rem',
              marginBottom: '1.5rem',
              fontStyle: 'italic',
            }}>
              If this tool helped you discover elite hodlers, consider supporting its development! ❤️
            </p>
            
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 235, 59, 0.08), rgba(76, 175, 80, 0.08), rgba(33, 150, 243, 0.08))',
              border: '1px solid rgba(255, 235, 59, 0.3)',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '1rem',
            }}>
              <div style={{
                color: '#ffeb3b',
                fontSize: '1rem',
                fontWeight: '600',
                marginBottom: '1rem',
                textShadow: '0 0 10px rgba(255, 235, 59, 0.3)',
              }}>
                💰 Donation Wallet (Any Token Welcome)
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}>
                <div style={{
                  fontFamily: 'Fira Code, monospace',
                  fontSize: '0.9rem',
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, rgba(5, 10, 20, 0.9), rgba(10, 5, 15, 0.95))',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 20, 147, 0.3)',
                  wordBreak: 'break-all',
                  maxWidth: '400px',
                }}>
                  0xD5A8b103DdaAF4A21268249A28742e115f35f3a9
                </div>
                
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('0xD5A8b103DdaAF4A21268249A28742e115f35f3a9');
                    // Show brief success feedback
                    const btn = event.target;
                    const originalText = btn.textContent;
                    btn.textContent = '✅ Copied!';
                    btn.style.background = 'linear-gradient(135deg, rgba(76, 175, 80, 0.8), rgba(33, 150, 243, 0.8))';
                    setTimeout(() => {
                      btn.textContent = originalText;
                      btn.style.background = '';
                    }, 2000);
                  }}
                  className="rainbowBtn"
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    fontFamily: 'Inter',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  }}
                >
                  📋 Copy Address
                </button>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1.5rem',
              flexWrap: 'wrap',
              fontSize: '0.9rem',
              color: '#9ca3af',
            }}>
              <span>💜 MATIC</span>
              <span>🌈 MANA</span>
              <span>💎 ETH</span>
              <span>🚀 USDC</span>
              <span>✨ Any Token</span>
            </div>
            
            <p style={{
              color: '#6b7280',
              fontSize: '0.8rem',
              marginTop: '1rem',
              fontStyle: 'italic',
            }}>
              🌟 100% optional • Keeps this tool free & open source • Thank you! 🌟
            </p>
          </div>
        </div>
      </div>

      {/* Captcha Modal */}
      {showCaptchaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(10px)',
        }}>
          <div className="card-glow neon-border" style={{
            background: 'linear-gradient(135deg, rgba(10, 15, 25, 0.98), rgba(15, 10, 20, 0.95))',
            borderRadius: '20px',
            padding: '3rem',
            backdropFilter: 'blur(25px)',
            border: '2px solid rgba(255, 20, 147, 0.5)',
            maxWidth: '500px',
            width: '90%',
            margin: '2rem',
            position: 'relative',
            animation: 'float 6s ease-in-out infinite',
          }}>
            {/* Close Button */}
            <button
              onClick={closeCaptchaModal}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'linear-gradient(135deg, rgba(255, 23, 68, 0.3), rgba(255, 152, 0, 0.3))',
                border: '1px solid rgba(255, 23, 68, 0.5)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                color: '#ff1744',
                fontSize: '1.2rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                fontWeight: 'bold',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, rgba(255, 23, 68, 0.5), rgba(255, 152, 0, 0.5))';
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, rgba(255, 23, 68, 0.3), rgba(255, 152, 0, 0.3))';
                e.target.style.transform = 'scale(1)';
              }}
            >
              ✕
            </button>

            {/* Modal Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
              <h2 className="rainbow-text" style={{
                fontFamily: 'Inter',
                fontSize: '1.8rem',
                fontWeight: '700',
                letterSpacing: '1px',
                marginBottom: '0.5rem',
              }}>
                SECURITY CHECK
              </h2>
              <p style={{
                color: '#9ca3af',
                fontSize: '1rem',
                fontStyle: 'italic',
              }}>
                Complete this simple math problem to proceed
              </p>
            </div>

            {/* Captcha Question */}
            <div style={{
              marginBottom: '2rem',
              padding: '2rem',
              background: 'linear-gradient(135deg, rgba(255, 235, 59, 0.08), rgba(76, 175, 80, 0.08), rgba(33, 150, 243, 0.08))',
              border: '1px solid rgba(255, 235, 59, 0.3)',
              borderRadius: '12px',
              textAlign: 'center',
            }}>
              <div style={{ 
                marginBottom: '1.5rem', 
                fontSize: '2rem',
                fontWeight: '700', 
                color: '#ffeb3b',
                fontFamily: 'Inter',
                textShadow: '0 0 15px rgba(255, 235, 59, 0.6)',
              }}>
                What is {captcha.question} ?
              </div>
              <input
                type="number"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="Answer"
                autoFocus
                style={{
                  width: '200px',
                  padding: '1rem',
                  fontSize: '1.2rem',
                  fontFamily: 'Inter',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, rgba(5, 10, 20, 0.9), rgba(10, 5, 15, 0.95))',
                  border: '2px solid rgba(255, 235, 59, 0.4)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  outline: 'none',
                  textAlign: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.3)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#ffeb3b';
                  e.target.style.boxShadow = '0 0 20px rgba(255, 235, 59, 0.4), inset 0 2px 10px rgba(0, 0, 0, 0.3)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 235, 59, 0.4)';
                  e.target.style.boxShadow = 'inset 0 2px 10px rgba(0, 0, 0, 0.3)';
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCaptchaSubmit();
                  }
                }}
              />
            </div>

            {/* Modal Buttons */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
            }}>
              <button
                onClick={closeCaptchaModal}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  fontFamily: 'Inter',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  background: 'linear-gradient(135deg, rgba(100, 100, 100, 0.3), rgba(120, 120, 120, 0.3))',
                  color: '#cccccc',
                  border: '1px solid rgba(100, 100, 100, 0.5)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(100, 100, 100, 0.5), rgba(120, 120, 120, 0.5))';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(100, 100, 100, 0.3), rgba(120, 120, 120, 0.3))';
                  e.target.style.transform = 'translateY(0px)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCaptchaSubmit}
                className="rainbowBtn"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  fontFamily: 'Inter',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                🚀 VERIFY & FETCH
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 