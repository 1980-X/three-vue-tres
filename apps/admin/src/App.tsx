import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthGate } from './auth/AuthGate';
import { Login } from './pages/Login';
import { Projects } from './pages/Projects';
import { PlatformTenants } from './pages/platform/Tenants';
import { AiProviders } from './pages/platform/AiProviders';
import { Assets } from './pages/Assets';
import { Venues } from './pages/Venues';
import { VenueEditor } from './pages/VenueEditor';
import { AiWorkbench } from './pages/AiWorkbench';

export function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <AuthGate>
                <Projects />
              </AuthGate>
            }
          />
          <Route
            path="/platform/tenants"
            element={
              <AuthGate>
                <PlatformTenants />
              </AuthGate>
            }
          />
          <Route
            path="/platform/ai-providers"
            element={
              <AuthGate>
                <AiProviders />
              </AuthGate>
            }
          />
          <Route
            path="/projects/:projectId/ai"
            element={
              <AuthGate>
                <AiWorkbench />
              </AuthGate>
            }
          />
          <Route
            path="/projects/:projectId/assets"
            element={
              <AuthGate>
                <Assets />
              </AuthGate>
            }
          />
          <Route
            path="/projects/:projectId/venues"
            element={
              <AuthGate>
                <Venues />
              </AuthGate>
            }
          />
          <Route
            path="/projects/:projectId/venues/:venueId"
            element={
              <AuthGate>
                <VenueEditor />
              </AuthGate>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
