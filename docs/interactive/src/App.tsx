import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import APIDocumentationPage from './pages/APIDocumentationPage'
import MonitoringPage from './pages/MonitoringPage'
import SecurityPage from './pages/SecurityPage'
import DeploymentPage from './pages/DeploymentPage'
import APITestingPage from './pages/APITestingPage'
import SearchPage from './pages/SearchPage'
import { DocumentationProvider } from './contexts/DocumentationContext'

function App() {
  return (
    <DocumentationProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/api" element={<APIDocumentationPage />} />
          <Route path="/api/:category" element={<APIDocumentationPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/monitoring/:category" element={<MonitoringPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/deployment" element={<DeploymentPage />} />
          <Route path="/testing" element={<APITestingPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </Layout>
    </DocumentationProvider>
  )
}

export default App