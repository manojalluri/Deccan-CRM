import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute, PublicRoute } from '@/components/auth/ProtectedRoute'
import { AdminLayout } from '@/layouts/AdminLayout'

// Admin pages
import { LoginPage } from '@/pages/admin/LoginPage'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { OrdersPage } from '@/pages/admin/OrdersPage'
import { BillingHistoryPage } from '@/pages/admin/BillingHistoryPage'
import { MenuPage as AdminMenuPage } from '@/pages/admin/MenuPage'
import { CategoriesPage } from '@/pages/admin/CategoriesPage'
import { TablesPage } from '@/pages/admin/TablesPage'
import { StaffPage } from '@/pages/admin/StaffPage'
import { AnalyticsPage } from '@/pages/admin/AnalyticsPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'


// Customer pages
import { MenuPage as CustomerMenuPage } from '@/pages/customer/MenuPage'
import { CartPage } from '@/pages/customer/CartPage'
import { OrderTrackingPage } from '@/pages/customer/OrderTrackingPage'

import { useAuth } from '@/contexts/AuthContext'
import { getDefaultRouteForRole } from '@/lib/permissions'

function AdminHomeRedirect() {
  const { profile } = useAuth()
  const targetRoute = getDefaultRouteForRole(profile?.role)
  return <Navigate to={targetRoute} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/admin/login" replace />} />

          {/* Customer Routes */}
          <Route path="/menu/:restaurantSlug/table/:tableToken" element={<CustomerMenuPage />} />
          <Route path="/menu/:restaurantSlug/table/:tableToken/cart" element={<CartPage />} />
          <Route path="/menu/:restaurantSlug/table/:tableToken/order/:orderId" element={<OrderTrackingPage />} />

          {/* Admin Auth */}
          <Route
            path="/admin/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <Routes>
                    <Route index element={<AdminHomeRedirect />} />
                    <Route
                      path="dashboard"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                          <DashboardPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="orders"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'staff', 'kitchen']}>
                          <OrdersPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="billing"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'staff']}>
                          <BillingHistoryPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="menu"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'staff', 'kitchen']}>
                          <AdminMenuPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="categories"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                          <CategoriesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="tables"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'staff']}>
                          <TablesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="staff"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                          <StaffPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="analytics"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                          <AnalyticsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin']}>
                          <SettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="*" element={<AdminHomeRedirect />} />
                  </Routes>
                </AdminLayout>
              </ProtectedRoute>
            }
          />
        </Routes>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'toast-base',
            style: {
              background: 'white',
              color: '#1a1917',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
              border: '1px solid #e8e6e1',
              borderRadius: '14px',
              padding: '14px 16px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
            },
            success: {
              iconTheme: { primary: '#16a34a', secondary: 'white' },
            },
            error: {
              iconTheme: { primary: '#dc2626', secondary: 'white' },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
