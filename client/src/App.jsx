import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Drive from './pages/Drive'
import Login from './pages/Login'
import Trash from './pages/Trash'
import SharedWithMe from './pages/SharedWithMe'
import SharedFile from './pages/SharedFile'
import ProtectedRoute from './components/ui/auth/ProtectedRoute'
import DashboardLayout from './components/layout/DashboardLayout'

const App = () => {
  return (
    <>
    <Toaster/>
    <Routes>
      <Route path='/login' element={<Login mode="login"/>}/>
      <Route path='/register' element={<Login mode="register"/>}/>
      <Route path='/s/:token' element={<SharedFile/>}/>
      {/* Private Routes jo auth mai banaya hai*/}
      <Route element={<ProtectedRoute/>}>
        <Route element={<DashboardLayout/>}>
          <Route path='/' element={<Drive/>}/>
          <Route path='/trash' element={<Trash/>}/>
          <Route path='/shared' element={<SharedWithMe/>}/>
        </Route>
      </Route>
      
      <Route path='*' element={<Navigate to="/" replace/>}/>
    </Routes>
    </>
  )
}
 
export default App
