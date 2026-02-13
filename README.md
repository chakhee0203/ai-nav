# AI Portfolio Manager

This is a mobile-first investment portfolio management application.

## Features

- **Mobile-First Design**: Optimized for mobile devices with a responsive layout.
- **Portfolio Management**: Manually add/remove stocks and funds. Data is persisted in local storage.
- **Automated Analysis**: Click "Analyze Portfolio" to fetch simulated data (price, sentiment, news, financials) and generate an AI-driven analysis.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide React (Icons)
- **Backend**: Node.js, Express (Simulated Analysis API)

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    cd client && npm install
    ```

2.  **Start the Application**:
    - **Backend**: Run `npm start` in the root directory.
    - **Frontend**: Run `npm run dev` in the `client` directory.

3.  **Access the App**:
    Open `http://localhost:5173` in your browser.

## Project Structure

- `client/`: Frontend React application.
- `server/`: Backend Express server handling API requests.
- `api/`: Vercel serverless function entry point (optional).

## Note on "Skill Tools"

Currently, the `/api/analyze` endpoint returns mock data to demonstrate the "skill tool" integration. In a production environment, this would connect to real financial data providers (e.g., Alpha Vantage, Yahoo Finance) and use an AI model (e.g., OpenAI) to generate the deep analysis text.
