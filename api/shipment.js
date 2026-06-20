/***********************************************
 * CV EPIC Warehouse - Shipment API Proxy
 * Fetches data from Google Apps Script
 * Handles CORS issues by proxying through Vercel
 ***********************************************/

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const response = await fetch(
      "https://script.google.com/macros/s/AKfycbxb3nDU0ul_XHAkkLWo8Gc5LbUDxNn5k3L34qOZIze2TVJxE4mZuMkq-mGdI36iZlLG/exec"
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Shipment API Error:", error);
    return res.status(500).json({ 
      error: "Failed to fetch shipment data",
      message: error.message 
    });
  }
}
