import { createContext, useCallback, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../config/api";
const AppContext = createContext();
const getErrMsg = (err, fallback) => {
    const details = err?.response?.data?.details;
    if (Array.isArray(details) && details.length > 0) {
        return details.map((d) => d.message).join(" ");
    }
    return err?.response?.data?.error || fallback;
};

export const AppProvider = ({ children }) => {
    const[user,setUser]=useState(null);
    const[isLoading,setIsLoading]=useState(true);

    const refreshUser=useCallback(async()=>{
        try{
            const {data}=await api.get("/api/auth/me");
            const currentUser = data?.user || data?.data?.user || null;
            setUser(currentUser);
            return currentUser;
        }catch(error){
            setUser(null)
            return null
        }
    },[])


    useEffect(()=>{
        refreshUser().finally(()=>setIsLoading(false))
    },[refreshUser])
    const authAction =async (requestFn,successMsg,errorFallback)=>{
        try{
            const{data}=await requestFn();
            const currentUser = data?.user || data?.data?.user || null;
            setUser(currentUser);
            if (successMsg) toast.success(successMsg)
                return true;
        } catch (error) {
            toast.error(getErrMsg(error,errorFallback))
            return false;

        }

    }
    const login =(email,password)=>{
        return authAction(()=> api.post("/api/auth/login",{email,password}),"Logged in successfully","Invalid email or password")
    }
    const register =(name,email,password)=>{
        return authAction(()=> api.post("/api/auth/register",{name,email,password}),"Registration successful","Registration failed")
    }
    const logout =async()=>{
        try{
            await api.post("/api/auth/logout")
            setUser(null)
            toast.success("Logged out successfully")
        }catch(error){
            toast.error(getErrMsg(error,"Logout failed"));
        }
    }
    const forgotPassword = async (email) => {
        try {
            const { data } = await api.post("/api/auth/forgot-password", { email });
            toast.success(data?.message || "Password reset link sent to your email");
            return data;
        } catch (error) {
            toast.error(getErrMsg(error, "Failed to send reset link"));
            return false;
        }
    };
    const resetPassword = async (token, password) => {
        return authAction(
            () => api.post(`/api/auth/reset-password/${token}`, { password }),
            "Password reset successful",
            "Failed to reset password"
        );
    };
    
    const value={
        user,setUser,login,register,logout,refreshUser,forgotPassword,resetPassword, isLoading,isAuthenticated:!!user
    }
    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp=()=> useContext(AppContext)