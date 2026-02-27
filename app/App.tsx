import React from 'react';
import LoginScreen from './src/screens/LoginScreen';
import ProfilingFlow from './src/screens/ProfilingFlow';
import MainLandingPage from './src/screens/MainLandingPage';
import { useOnboardingStore } from './src/store/useOnboardingStore';

function App() {
  const { tempJwt, isOnboarded } = useOnboardingStore();

  if (isOnboarded) {
    return <MainLandingPage />;
  }

  if (tempJwt) {
    return <ProfilingFlow />;
  }

  return <LoginScreen />;
}

export default App;
