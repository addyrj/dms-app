// src/navigation/AppNavigator.tsx
// CHANGED: Login → Player directly (skip Dashboard)
import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AppProvider, useApp } from '../context/AppContext';

import LoginScreen     from '../screens/LoginScreen';
import SyncScreen      from '../screens/SyncScreen';
import PlayerScreen    from '../screens/PlayerScreen';
import DocumentScreen  from '../screens/DocumentScreen';

export type RootStackParamList = {
  Login:     undefined;
  Sync:      undefined;
  Player:    undefined;
  Document:  { file: any; duration: number };
};

const Stack = createStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { isLoggedIn } = useApp();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    if (!navRef.current) return;
    if (isLoggedIn) {
      // Go straight to Player — skip Dashboard
      navRef.current.reset({
        index: 0,
        routes: [{ name: 'Player' }],
      });
    } else {
      navRef.current.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [isLoggedIn]);

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animationEnabled: true }}
        initialRouteName="Login">
        <Stack.Screen name="Login"     component={LoginScreen} />
        <Stack.Screen name="Sync"      component={SyncScreen} />
        <Stack.Screen name="Player"    component={PlayerScreen} />
        <Stack.Screen name="Document"  component={DocumentScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function AppNavigator() {
  return (
    <AppProvider onLogout={() => {}}>
      <RootNavigator />
    </AppProvider>
  );
}







// ----------------------------------------------------

// // src/navigation/AppNavigator.tsx
// import React, { useEffect, useRef } from 'react';
// import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
// import { createStackNavigator } from '@react-navigation/stack';
// import { AppProvider, useApp } from '../context/AppContext';

// import LoginScreen     from '../screens/LoginScreen';
// import DashboardScreen from '../screens/DashboardScreen';
// import SyncScreen      from '../screens/SyncScreen';
// import PlayerScreen    from '../screens/PlayerScreen';
// import DocumentScreen  from '../screens/DocumentScreen';

// export type RootStackParamList = {
//   Login:     undefined;
//   Dashboard: undefined;
//   Sync:      undefined;
//   Player:    undefined;
//   Document:  { file: any; duration: number };
// };

// const Stack = createStackNavigator<RootStackParamList>();

// function RootNavigator() {
//   const { isLoggedIn } = useApp();
//   const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

//   // When login state changes — navigate imperatively
//   useEffect(() => {
//     if (!navRef.current) return;
//     if (isLoggedIn) {
//       navRef.current.reset({
//         index: 0,
//         routes: [{ name: 'Dashboard' }],
//       });
//     } else {
//       navRef.current.reset({
//         index: 0,
//         routes: [{ name: 'Login' }],
//       });
//     }
//   }, [isLoggedIn]);

//   return (
//     <NavigationContainer ref={navRef}>
//       <Stack.Navigator
//         screenOptions={{ headerShown: false, animationEnabled: true }}
//         initialRouteName="Login">
//         <Stack.Screen name="Login"      component={LoginScreen} />
//         <Stack.Screen name="Dashboard"  component={DashboardScreen} />
//         <Stack.Screen name="Sync"       component={SyncScreen} />
//         <Stack.Screen name="Player"     component={PlayerScreen} />
//         <Stack.Screen name="Document"   component={DocumentScreen} />
//       </Stack.Navigator>
//     </NavigationContainer>
//   );
// }

// export default function AppNavigator() {
//   return (
//  <AppProvider onLogout={() => navRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] })}>
//       <RootNavigator />
//     </AppProvider>
//   );
// }
