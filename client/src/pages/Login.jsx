import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { User, Mail, Lock, ArrowLeft, KeyRound } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/appcontext';
import toast from 'react-hot-toast';

const Login = ({ mode = "login" }) => {
    const isRegister = mode === "register";
    const isForgot = mode === "forgot";
    const isReset = mode === "reset";

    const { token } = useParams();
    const navigate = useNavigate();
    const { login, register, forgotPassword, resetPassword } = useApp();

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: ""
    });
    const [isLoading, setIsLoading] = useState(false);
    const [resetLinkSent, setResetLinkSent] = useState(false);

    const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isRegister) {
                const ok = await register(form.name, form.email, form.password);
                if (ok) navigate("/");
            } else if (isForgot) {
                const res = await forgotPassword(form.email);
                if (res) {
                    setResetLinkSent(true);
                }
            } else if (isReset) {
                if (form.password !== form.confirmPassword) {
                    toast.error("Passwords do not match");
                    setIsLoading(false);
                    return;
                }
                const ok = await resetPassword(token, form.password);
                if (ok) navigate("/");
            } else {
                const ok = await login(form.email, form.password);
                if (ok) navigate("/");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen text-zinc-900 flex flex-col md:flex-row">
            {/* left panel */}
            <div className="md:w-1/2 p-8 md:p-12 lg:p-16 bg-linear-to-br from-orange-50 via-zinc-100 to-red-50 border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col justify-between relative overflow-hidden">
                <div className='absolute inset-0 bg-[url("/pattern.svg")]'></div>
                <div className="relative z-10 flex items-center gap-3">
                    <img src="/logo.svg" alt="xenoDrive Logo" className="max-h-9" />
                    <span className="text-2xl font-medium uppercase text-zinc-900">xenoDrive</span>
                </div>
                <div className="relative z-10 mt-12 space-y-6">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl tracking-tight text-zinc-900 leading-tight">
                        Secure, Simple & Fast<br />
                        <span className="text-orange-600">Cloud Storage.</span>
                    </h2>
                    <p className="text-sm md:text-base text-zinc-600 max-w-md leading-relaxed">
                        Store your files securely in our drive, organise into folders, share with permission and access anywhere.
                    </p>
                </div>
                <div className="relative z-10 text-sm text-zinc-500">xenoDrive</div>
            </div>

            {/* right panel */}
            <div className="md:w-1/2 p-8 md:p-12 lg:p-16 flex items-center justify-center bg-white">
                <div className="w-full max-w-md space-y-6 animate-fade-in">
                    <div>
                        <h3 className='text-2xl font-medium text-zinc-900'>
                            {isRegister
                                ? "Create an account"
                                : isForgot
                                ? "Reset your password"
                                : isReset
                                ? "Set new password"
                                : "Welcome back"}
                        </h3>
                        <p className='text-sm text-zinc-500 mt-1'>
                            {isRegister
                                ? "Enter your details below to get started with 1GB free storage"
                                : isForgot
                                ? "Enter your email address to receive password reset instructions"
                                : isReset
                                ? "Enter your new password below to recover your account"
                                : "Enter your credentials to access your Drive"}
                        </p>
                    </div>

                    {isForgot && resetLinkSent ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-slate-700 space-y-1">
                                <p className="font-medium text-orange-900">Reset instructions generated!</p>
                                <p className="text-xs text-orange-700">
                                    If an account exists for <span className="font-semibold">{form.email}</span>, password reset instructions have been generated.
                                </p>
                            </div>
                            <Link to="/login" className="block text-center text-sm font-medium text-orange-600 hover:underline">
                                Return to Sign In
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className='space-y-4'>
                            {isRegister && (
                                <Input
                                    label="Full Name"
                                    icon={User}
                                    placeholder="Enter your full name"
                                    value={form.name}
                                    onChange={(e) => updateField("name", e.target.value)}
                                    required
                                />
                            )}

                            {!isReset && (
                                <Input
                                    label="Email Address"
                                    type="email"
                                    icon={Mail}
                                    placeholder="abc@example.com"
                                    value={form.email}
                                    onChange={(e) => updateField("email", e.target.value)}
                                    required
                                />
                            )}

                            {!isForgot && (
                                <Input
                                    label={isReset ? "New Password" : "Password"}
                                    type="password"
                                    icon={Lock}
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={(e) => updateField("password", e.target.value)}
                                    required
                                />
                            )}

                            {isReset && (
                                <Input
                                    label="Confirm New Password"
                                    type="password"
                                    icon={KeyRound}
                                    placeholder="••••••••"
                                    value={form.confirmPassword}
                                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                                    required
                                />
                            )}

                            {/* Forgot password link on login view */}
                            {!isRegister && !isForgot && !isReset && (
                                <div className="flex justify-end">
                                    <Link
                                        to="/forgot-password"
                                        className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                            )}

                            <Button
                                type='submit'
                                variant='primary'
                                className="w-full py-3"
                                isLoading={isLoading}
                            >
                                <span className="font-medium text-base">
                                    {isRegister
                                        ? "Register Account"
                                        : isForgot
                                        ? "Send Reset Link"
                                        : isReset
                                        ? "Update Password"
                                        : "Sign In"}
                                </span>
                            </Button>
                        </form>
                    )}

                    {/* Footer switch links */}
                    <div className="text-center text-sm text-zinc-600">
                        {isForgot || isReset ? (
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-1.5 font-medium text-orange-600 hover:text-orange-700 hover:underline"
                            >
                                <ArrowLeft className="size-4" />
                                <span>Back to Sign In</span>
                            </Link>
                        ) : isRegister ? (
                            <>
                                Already have an account?{" "}
                                <Link
                                    to="/login"
                                    className="font-medium text-orange-600 hover:text-orange-700 hover:underline"
                                >
                                    Sign in
                                </Link>
                            </>
                        ) : (
                            <>
                                Don't have an account?{" "}
                                <Link
                                    to="/register"
                                    className="font-medium text-orange-600 hover:text-orange-700 hover:underline"
                                >
                                    Create an account
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
