import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ProfilingFlow from './src/screens/ProfilingFlow';
import MainLandingPage from './src/screens/MainLandingPage';
import { useOnboardingStore } from './src/store/useOnboardingStore';
import { speechService } from './src/services/speechService';

function App() {
  const { tempJwt, isOnboarded, setPendingJoinCode } = useOnboardingStore();
  const [isSignUp, setIsSignUp] = useState(false);

  const parseJoinCodeFromUrl = (url: string) => {
    try {
      if (!url) return null;

      if (url.startsWith('dndmode://join/')) {
        return (url.split('dndmode://join/')[1] || '').split(/[?#]/)[0].trim().toUpperCase() || null;
      }

      const parsed = new URL(url);
      const path = parsed.pathname || '';
      if (path.startsWith('/join/')) {
        return (path.split('/join/')[1] || '').split(/[?#]/)[0].trim().toUpperCase() || null;
      }
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const code = parseJoinCodeFromUrl(url);
      if (code) {
        setPendingJoinCode(code);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        const code = parseJoinCodeFromUrl(url);
        if (code) {
          setPendingJoinCode(code);
        }
      }
    }).catch(() => {
      // ignore
    });

    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, [setPendingJoinCode]);

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
