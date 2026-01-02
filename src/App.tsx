import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthGuard } from './hooks/useAuthGuard'
import AuthPage from './routes/AuthPage'
import OnboardingPage from './routes/OnboardingPage'
import DashboardLayout from './routes/DashboardLayout'
import SetupLayout from './routes/SetupLayout'
import SetupInterviewPage from './routes/SetupInterviewPage'
import SetupReviewPage from './routes/SetupReviewPage'
import SetupCompletePage from './routes/SetupCompletePage'
import HomePage from './routes/HomePage'
import SettingsPage from './routes/SettingsPage'
import AmplitudeConnectPage from './routes/AmplitudeConnectPage'
import AmplitudeEventsPage from './routes/AmplitudeEventsPage'
import AmplitudeConfirmPage from './routes/AmplitudeConfirmPage'
import AccountMappingPage from './routes/AccountMappingPage'
import ActivityDefinitionsPage from './routes/ActivityDefinitionsPage'
import SyntheticEventPage from './routes/SyntheticEventPage'
import ValueRulesPage from './routes/ValueRulesPage'
import JourneysListPage from './routes/JourneysListPage'
import JourneyEditorPage from './routes/JourneyEditorPage'
import { SetupResumeScreen } from './components/setup/SetupResumeScreen'
import { useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useEffect } from 'react'

function AppRoutes() {
  const {
    isAuthenticated,
    isLoading,
    needsOnboarding,
    user,
    setupStatus,
    setupProgress,
    setupInProgress,
  } = useAuthGuard();

  const startSetup = useMutation(api.setupProgress.start);

  // Auto-start setup for users who haven't started yet
  useEffect(() => {
    if (user && !setupStatus && !needsOnboarding) {
      // User exists but no setup status - initialize setup
      startSetup().catch(console.error);
    }
  }, [user, setupStatus, needsOnboarding, startSetup]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/auth/*" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  // Legacy onboarding flow (for existing users)
  if (needsOnboarding) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  // Setup mode: user is in progress but paused - show resume screen
  if (setupInProgress && setupProgress?.status === 'paused') {
    return (
      <SetupResumeScreen
        userName={user?.name?.split(' ')[0]}
        currentStep={setupProgress.currentStep}
        stepsCompleted={setupProgress.stepsCompleted}
      />
    );
  }

  // Setup mode: user is actively in setup
  if (setupInProgress && setupProgress?.status === 'active') {
    return (
      <Routes>
        <Route path="/setup" element={<SetupLayout />}>
          <Route path="interview" element={<SetupInterviewPage />} />
          <Route path="review" element={<SetupReviewPage />} />
          <Route path="complete" element={<SetupCompletePage />} />
        </Route>
        {/* Allow settings during setup */}
        <Route path="/settings" element={<SettingsPage />} />
        {/* Redirect everything else to current setup step */}
        <Route
          path="*"
          element={
            <Navigate
              to={`/setup/${setupProgress?.currentStep === 'review_save' ? 'review' : 'interview'}`}
              replace
            />
          }
        />
      </Routes>
    );
  }

  // Setup complete - full app access
  return (
    <Routes>
      <Route path="/auth" element={<Navigate to="/" replace />} />
      <Route path="/onboarding" element={<Navigate to="/" replace />} />
      <Route path="/setup/*" element={<Navigate to="/" replace />} />
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="sources/amplitude/connect" element={<AmplitudeConnectPage />} />
        <Route path="sources/amplitude/:connectionId/events" element={<AmplitudeEventsPage />} />
        <Route path="sources/amplitude/:connectionId/confirm" element={<AmplitudeConfirmPage />} />
        <Route path="sources/amplitude/:connectionId/account-mapping" element={<AccountMappingPage />} />
        <Route path="sources/amplitude/:connectionId/activities" element={<ActivityDefinitionsPage />} />
        <Route path="sources/amplitude/:connectionId/activities/synthetic" element={<SyntheticEventPage />} />
        <Route path="sources/amplitude/:connectionId/value-rules" element={<ValueRulesPage />} />
        <Route path="journeys" element={<JourneysListPage />} />
        <Route path="journeys/:journeyId" element={<JourneyEditorPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
