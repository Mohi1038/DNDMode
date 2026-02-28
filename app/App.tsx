import React, { useEffect, useState } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ProfilingFlow from './src/screens/ProfilingFlow';
import MainLandingPage from './src/screens/MainLandingPage';
import { useOnboardingStore } from './src/store/useOnboardingStore';
import { speechService } from './src/services/speechService';

function App() {
  const { tempJwt, isOnboarded } = useOnboardingStore();
  const [isSignUp, setIsSignUp] = useState(false);

  // Start STT with wake word in the background (runs globally, regardless of screen)
  useEffect(() => {
    speechService.startSTT(
      () => {
        console.log('[App] 🎯 Wake word detected!');
      },
      cmd => {
        console.log('[App] 📤 Command:', cmd);
      },
    );

    return () => speechService.stopSTT();
  }, []);

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
