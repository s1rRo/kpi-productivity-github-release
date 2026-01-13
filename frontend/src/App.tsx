import React from 'react';
import FeedbackButton from './components/FeedbackButton';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          KPI Productivity System
        </h1>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-700 mb-4">
            Welcome to the KPI Productivity tracking system.
          </p>

          <FeedbackButton />
        </div>
      </div>
    </div>
  );
}

export default App;
