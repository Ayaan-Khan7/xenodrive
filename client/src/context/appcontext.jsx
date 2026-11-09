import { createContext, useCallback, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../config/api";
const AppContext = createContext();
const getErrMsg=(err, fallback)=>err?.response?.data?.error || fallback ;

export const AppProvider = ({ children }) => {
    const[user,setUser]=useState(null);
    const[isLoading,setIsLoading]=useState(true);

    const refreshUser=useCallback(async()=>{
        try{
            const {data}=await api.get("/api/auth/me");
            setUser(data.user)
            return data.user
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
            setUser(data.user)
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
    
    const value={
        user,setUser,login,register,logout,refreshUser, isLoading,isAuthenticated:!!user
    }
    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp=()=> useContext(AppContext)