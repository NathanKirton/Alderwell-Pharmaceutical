import { render, screen } from '@testing-library/react'
import App from './App'

jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: null,
    userProfile: null,
    cachedRole: null,
    loading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
  }),
}))

test('renders login screen for unauthenticated users', async () => {
  render(<App />)
  expect(await screen.findByText(/welcome back/i)).toBeInTheDocument()
})
