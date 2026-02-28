import React, { useState } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ProfilingFlow from './src/screens/ProfilingFlow';
import MainLandingPage from './src/screens/MainLandingPage';
import { useOnboardingStore } from './src/store/useOnboardingStore';

function App() {
  const { tempJwt, isOnboarded } = useOnboardingStore();
  const [isSignUp, setIsSignUp] = useState(false);

  if (isOnboarded) {
    return <MainLandingPage />;
  }

  if (tempJwt) {
    return <ProfilingFlow />;
  }

  if (isSignUp) {
    return <SignUpScreen onBackToLogin={() => setIsSignUp(false)} />;
  }

  return <LoginScreen onSignUpPress={() => setIsSignUp(true)} />;
}

export default App;
