import React, { createContext, useContext } from 'react';

// Simple demo auth context to satisfy imports and enable optional demo mode.
// Provides a static, always-authenticated demo user shape compatible with useAuth.
const DemoAuthContext = createContext({
	user: {
		uid: 'demo-uid',
		email: 'demo.user@example.com',
		displayName: 'Demo User',
		photoURL: null
	},
	userProfile: {
		displayName: 'Demo User',
		createdAt: { toDate: () => new Date() },
		tasksCount: 0,
		subscription: 'Demo',
		preferences: {
			theme: 'light',
			notifications: true
		}
	},
	isAuthenticated: true,
	loading: false,
	signup: async () => ({ success: true }),
	login: async () => ({ success: true }),
	signInWithGoogle: async () => ({ success: true }),
	resetPassword: async () => ({ success: true }),
	logout: async () => ({ success: true }),
	updateUserProfile: async () => ({ success: true })
});

export const useDemoAuth = () => useContext(DemoAuthContext);

export const DemoAuthProvider = ({ children }) => {
	return (
		<DemoAuthContext.Provider value={useDemoAuth()}>
			{children}
		</DemoAuthContext.Provider>
	);
};

export default DemoAuthContext;

