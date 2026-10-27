import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Drive from './pages/drive'
import Login from './pages/Login'

const App = () => {
  return (
    <>
    <Toaster/>
    <Routes>
      <Route path='/login' element={<Login mode="login"/>}/>
      <Route path='/register' element={<Login mode="register"/>}/>
      <Route path='/' element={<Drive/>}/>
      <Route path='*' element={<Navigate to="/" replace/>}/>
    </Routes>
    </>
  )
}
 
export default App