import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../../../context/appcontext'
import { Spinner } from '../Spinner'

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useApp()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Spinner size="md" className="text-orange-600" />
        <p className="text-sm text-muted-foreground font-medium mt-2">
          Loading XenoDrive...
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export default ProtectedRoute